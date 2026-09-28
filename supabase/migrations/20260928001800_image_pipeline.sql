-- Issue 018: image verification job plumbing (docs/systems/image-verification.md steps 1–10,
-- INV-I3, INV-I4, EC-I4 to EC-I6, EC-I9). All functions here are service-role only.

-- INV-I3: every automatic decision records the thresholds it used.
alter table public.image_checks add column thresholds jsonb;

-- ── invoke_internal_job with a JSON body (extends the issue-012 definition) ──
create or replace function public.invoke_internal_job(p_path text, p_body jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'internal_job_secret' limit 1;
  if base_url is null or secret is null then
    return null;
  end if;
  select net.http_post(
    url := rtrim(base_url, '/') || p_path,
    body := coalesce(p_body, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret)
  ) into request_id;
  return request_id;
end $$;
revoke execute on function public.invoke_internal_job(text, jsonb) from public, anon, authenticated;
grant execute on function public.invoke_internal_job(text, jsonb) to service_role;

-- ── claim (FOR UPDATE SKIP LOCKED; attempts counted at claim time) ──────────
create or replace function public.claim_image_check(p_limit int default 5, p_job_id uuid default null)
returns setof public.image_checks
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.image_checks c
     set state = 'running', locked_at = now(), attempts = c.attempts + 1
   where c.id in (
     select q.id from public.image_checks q
      where q.state = 'queued' and q.attempts < 3 and (p_job_id is null or q.id = p_job_id)
      order by q.created_at
      for update skip locked
      limit greatest(1, least(p_limit, 20))
   )
  returning c.*;
end $$;

-- Retryable vendor error (attempts < 3): back to the queue; the next cron tick retries.
create or replace function public.requeue_image_check(p_job_id uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.image_checks
     set state = 'queued', locked_at = null, last_error = left(p_error, 1000)
   where id = p_job_id and state = 'running';
end $$;

-- Placeholder: issue 021 implements the listing re-evaluation (INV: never makes anything live here).
create or replace function public.evaluate_listing(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform p_listing_id;
end $$;

-- ── record (step 10, one transaction) ───────────────────────────────────────
-- Returns 'RECORDED', or 'SKIPPED' when the job is already done (EC-I9), the photo was deleted
-- (EC-I4) or the listing removed (EC-I5). On SKIPPED the caller deletes any variants it uploaded.
create or replace function public.record_image_decision(
  p_job_id uuid,
  p_decision public.image_status,
  p_reason text,
  p_car jsonb default null,
  p_ai jsonb default null,
  p_signals jsonb default null,
  p_phash_match jsonb default null,
  p_thresholds jsonb default null,
  p_phash text default null,
  p_width int default null,
  p_height int default null,
  p_public_paths jsonb default null,
  p_error text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  job public.image_checks;
  img public.listing_images;
  v_listing_status public.listing_status;
begin
  if p_decision not in ('passed', 'rejected', 'in_review') then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  select * into job from image_checks where id = p_job_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if job.state in ('done', 'failed') then return 'SKIPPED'; end if;

  select * into img from listing_images where id = job.image_id for update;
  select status into v_listing_status from listings where id = img.listing_id;
  if img.deleted_at is not null or v_listing_status = 'removed' then
    update image_checks set state = 'done', locked_at = null where id = job.id;
    return 'SKIPPED';
  end if;

  update image_checks
     set state = 'done', locked_at = null,
         car_check = p_car, ai_check = p_ai, metadata_signals = p_signals, phash_match = p_phash_match,
         thresholds = p_thresholds, last_error = coalesce(p_error, last_error),
         decision = p_decision, decision_reason = p_reason,
         decided_by = case when job.forced_decision is null then null else decided_by end,
         decided_at = now()
   where id = job.id;

  update listing_images
     set status = p_decision,
         status_reason = case when p_decision = 'passed' then null else p_reason end,
         public_paths = case when p_decision = 'passed' then coalesce(p_public_paths, public_paths) else null end,
         phash = coalesce(p_phash::bit(64), phash),
         width = coalesce(p_width, width),
         height = coalesce(p_height, height)
   where id = img.id;

  perform evaluate_listing(img.listing_id);
  return 'RECORDED';
end $$;

-- ── pHash reuse check (step 7; other shops only, EC-I7) ─────────────────────
create or replace function public.find_phash_match(p_image_id uuid, p_phash text, p_max_distance int)
returns table (matched_image_id uuid, matched_shop_id uuid, distance int)
language sql stable security definer set search_path = public as $$
  select i.id, i.shop_id, bit_count(i.phash # p_phash::bit(64))::int
    from listing_images i
   where i.phash is not null
     and i.deleted_at is null
     and i.status in ('passed', 'in_review', 'checking')
     and i.id <> p_image_id
     and i.shop_id <> (select shop_id from listing_images where id = p_image_id)
     and bit_count(i.phash # p_phash::bit(64)) <= p_max_distance
   order by 3
   limit 1
$$;

-- ── stale jobs (EC-I6): a crashed runner's job returns to the queue, or fails after 3 attempts ──
create or replace function public.requeue_stale_checks() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with failed as (
    update image_checks
       set state = 'failed', locked_at = null, decision = 'in_review',
           decision_reason = 'Automatic check unavailable, under manual review.',
           last_error = coalesce(last_error, 'stale after 3 attempts'), decided_at = now()
     where state = 'running' and locked_at < now() - interval '5 minutes' and attempts >= 3
    returning image_id
  )
  update listing_images i
     set status = 'in_review', status_reason = 'Automatic check unavailable, under manual review.'
    from failed f
   where i.id = f.image_id and i.status = 'checking';

  update image_checks set state = 'queued', locked_at = null
   where state = 'running' and locked_at < now() - interval '5 minutes' and attempts < 3;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.claim_image_check(int, uuid) from public, anon, authenticated;
revoke execute on function public.requeue_image_check(uuid, text) from public, anon, authenticated;
revoke execute on function public.evaluate_listing(uuid) from public, anon, authenticated;
revoke execute on function public.record_image_decision(uuid, public.image_status, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, int, int, jsonb, text) from public, anon, authenticated;
revoke execute on function public.find_phash_match(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.requeue_stale_checks() from public, anon, authenticated;
grant execute on function public.claim_image_check(int, uuid) to service_role;
grant execute on function public.requeue_image_check(uuid, text) to service_role;
grant execute on function public.evaluate_listing(uuid) to service_role;
grant execute on function public.record_image_decision(uuid, public.image_status, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, int, int, jsonb, text) to service_role;
grant execute on function public.find_phash_match(uuid, text, int) to service_role;
grant execute on function public.requeue_stale_checks() to service_role;

-- ── owner delete of a passed photo also unpublishes it (extends issue 016) ──
create or replace function public.delete_listing_image(p_image_id uuid)
returns public.listing_images
language plpgsql security definer set search_path = public as $$
declare
  img public.listing_images;
  l public.listings;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into img from listing_images where id = p_image_id for update;
  if not found or img.deleted_at is not null or not owns_shop(img.shop_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into l from listings where id = img.listing_id for update;
  if l.status = 'live' and img.status = 'passed'
     and (select count(*) from listing_images
           where listing_id = l.id and status = 'passed' and deleted_at is null and id <> img.id)
         < coalesce(setting_num('min_photos'), 4) then
    raise exception 'PHOTO_COUNT' using errcode = 'P0001';
  end if;
  update listing_images set deleted_at = now() where id = img.id returning * into img;
  if img.public_paths is not null then
    perform invoke_internal_job('/api/internal/unpublish-image', jsonb_build_object('image_id', img.id));
  end if;
  perform evaluate_listing(img.listing_id);
  return img;
end $$;

-- ── triggers and schedules ──────────────────────────────────────────────────
-- A new job wakes the runner at once; the minute cron job is the safety net (retries, missed calls).
create or replace function public.image_checks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.invoke_internal_job('/api/internal/process-image-checks');
  return null;
end $$;
create trigger image_checks_process after insert on public.image_checks
  for each statement execute function public.image_checks_after_insert();

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('process-image-checks', '* * * * *',
      $cron$ select public.invoke_internal_job('/api/internal/process-image-checks') $cron$);
    perform cron.schedule('requeue-stale-checks', '*/5 * * * *', $cron$ select public.requeue_stale_checks() $cron$);
  end if;
end $$;
