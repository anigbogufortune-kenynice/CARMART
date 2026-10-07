-- Issue 040: admin decisions on reviewed photos (docs/systems/image-verification.md → admin_approve,
-- admin_reject; ADR-011). Each RPC queues a job with forced_decision: the runner skips the vendor
-- checks, then publishes (approve: strip + encode + variants) or unpublishes (reject), records the
-- decision and re-evaluates the listing. The photo moves to 'checking' at once, so it leaves the
-- review queue and stops showing publicly while the job runs.

create or replace function public.admin_approve_image(p_image_id uuid) returns public.listing_images
language plpgsql security definer set search_path = public as $$
declare img public.listing_images;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into img from listing_images where id = p_image_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if img.status <> 'in_review' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  update listing_images set status = 'checking', status_reason = null where id = img.id returning * into img;
  insert into image_checks (image_id, forced_decision, decided_by) values (img.id, 'passed', auth.uid());
  perform log_admin_action('image.approve', 'image', img.id::text, null,
    jsonb_build_object('before', 'in_review', 'after', 'passed', 'listing_id', img.listing_id));
  return img;
end $$;

create or replace function public.admin_reject_image(p_image_id uuid, p_reason text) returns public.listing_images
language plpgsql security definer set search_path = public as $$
declare
  img public.listing_images;
  before_status public.image_status;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into img from listing_images where id = p_image_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if img.status not in ('in_review', 'passed') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  before_status := img.status;
  update listing_images set status = 'checking', status_reason = null where id = img.id returning * into img;
  insert into image_checks (image_id, forced_decision, decision_reason, decided_by)
    values (img.id, 'rejected', btrim(p_reason), auth.uid());
  perform log_admin_action('image.reject', 'image', img.id::text, btrim(p_reason),
    jsonb_build_object('before', before_status, 'after', 'rejected', 'listing_id', img.listing_id));
  return img;
end $$;

revoke execute on function public.admin_approve_image(uuid) from public, anon;
revoke execute on function public.admin_reject_image(uuid, text) from public, anon;
grant execute on function public.admin_approve_image(uuid) to authenticated;
grant execute on function public.admin_reject_image(uuid, text) to authenticated;

-- evaluate_listing gains the live branch (INV-L2); everything else is unchanged from issue 022.
create or replace function public.evaluate_listing(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  n_rejected int;
  n_pending int;
  n_review int;
  n_passed int;
  v_owner uuid;
  v_title text;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.status not in ('checking', 'in_review', 'live') then return; end if;
  select owner_id into v_owner from shops where id = l.shop_id;
  v_title := listing_title(l.id);

  -- INV-L2 (issue 040): a live listing that drops below the minimum of passed photos (e.g. an admin
  -- rejected one) goes to review with image_review. Otherwise a live listing is left as it is.
  if l.status = 'live' then
    if (select count(*) from listing_images where listing_id = l.id and deleted_at is null and status = 'passed')
       < coalesce(setting_num('min_photos'), 4) then
      update listings
         set status = 'in_review', status_reason = null, version = version + 1,
             review_flags = case when 'image_review' = any (review_flags) then review_flags
                                 else review_flags || 'image_review'::review_flag end
       where id = l.id;
    end if;
    return;
  end if;

  select count(*) filter (where status = 'rejected'),
         count(*) filter (where status in ('uploaded', 'checking')),
         count(*) filter (where status = 'in_review'),
         count(*) filter (where status = 'passed')
    into n_rejected, n_pending, n_review, n_passed
    from listing_images where listing_id = l.id and deleted_at is null;

  -- Rule 1: any rejected photo.
  if n_rejected > 0 then
    update listings set status = 'rejected', status_reason = 'One or more photos were rejected', version = version + 1
     where id = l.id;
    perform enqueue_notification(v_owner, 'listing_rejected', l.id, jsonb_build_object(
      'title', v_title, 'listingId', l.id,
      'photos', coalesce((
        select jsonb_agg(jsonb_build_object('position', r.n, 'reason', coalesce(r.status_reason, 'This photo didn''t pass our checks')) order by r.n)
          from (select status, status_reason, row_number() over (order by position) as n
                  from listing_images where listing_id = l.id and deleted_at is null) r
         where r.status = 'rejected'), '[]'::jsonb)));
    return;
  end if;
  -- Rule 2: still checking.
  if n_pending > 0 then return; end if;

  -- INV-L1: another shop's listing may have gone live with this VIN since submit.
  if exists (select 1 from listings o where o.vin = l.vin and o.id <> l.id and o.status = 'live')
     and not ('duplicate_vin' = any (l.review_flags)) then
    l.review_flags := l.review_flags || 'duplicate_vin'::review_flag;
    update listings set review_flags = l.review_flags where id = l.id;
  end if;

  -- Rule 3: a photo or a flag needs an admin.
  if n_review > 0 or cardinality(l.review_flags) > 0 then
    if l.status <> 'in_review' then
      update listings set status = 'in_review', status_reason = null, version = version + 1 where id = l.id;
      -- Announce review once per submission.
      if not exists (select 1 from notifications
                      where ref_id = l.id and kind = 'listing_in_review'
                        and created_at >= coalesce(l.submitted_at, '-infinity'::timestamptz)) then
        perform enqueue_notification(v_owner, 'listing_in_review', l.id, jsonb_build_object('title', v_title, 'listingId', l.id));
      end if;
    end if;
    return;
  end if;

  -- Photos deleted while checking can leave too few (INV-L2): send it back to the seller.
  if n_passed < coalesce(setting_num('min_photos'), 4) then
    update listings set status = 'rejected', status_reason = 'A listing needs at least 4 approved photos', version = version + 1
     where id = l.id;
    perform enqueue_notification(v_owner, 'listing_rejected', l.id, jsonb_build_object(
      'title', v_title, 'listingId', l.id, 'photos', '[]'::jsonb));
    return;
  end if;

  -- Rule 4: live. expires_at is set on first publication or after it lapsed; a re-check keeps it.
  update listings
     set status = 'live', status_reason = null, live_at = now(),
         expires_at = case when expires_at is null or expires_at < now()
                           then now() + make_interval(days => coalesce(setting_num('listing_expiry_days'), 60)::int)
                           else expires_at end,
         version = version + 1
   where id = l.id;
  -- Announce first publication (or a relaunch after expiry), not a re-check of a car that was live.
  if l.live_at is null or l.expires_at is null or l.expires_at < now() then
    perform enqueue_notification(v_owner, 'listing_live', l.id, jsonb_build_object('title', v_title, 'listingId', l.id));
  end if;
end $$;
