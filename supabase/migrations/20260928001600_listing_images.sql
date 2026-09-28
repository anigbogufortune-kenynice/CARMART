-- Issue 016: listing photos, private quarantine storage, upload limits and the job queue
-- (docs/schema.md → listing_images, image_checks, upload_events, Storage buckets;
--  docs/systems/image-verification.md → request_upload, complete, owner_delete; INV-I1, INV-I4, INV-I7).

create type public.image_status as enum ('uploaded', 'checking', 'passed', 'rejected', 'in_review');
create type public.check_job_state as enum ('queued', 'running', 'done', 'failed');

-- ── listing_images ──────────────────────────────────────────────────────────
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  position smallint not null check (position between 0 and 99),
  quarantine_path text not null unique,            -- object name in listing-quarantine: {shop_id}/{listing_id}/{image_id}
  public_paths jsonb,
  status public.image_status not null default 'uploaded',
  status_reason text,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int not null check (bytes between 1 and 10485760),
  width int,
  height int,
  phash bit(64),
  replaces_image_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index listing_images_position_key on public.listing_images (listing_id, position) where deleted_at is null;
create index listing_images_listing_idx on public.listing_images (listing_id, position) where deleted_at is null;
create index listing_images_phash_idx on public.listing_images (phash) where phash is not null;
create index listing_images_status_idx on public.listing_images (status, created_at) where status = 'in_review';
create trigger listing_images_set_updated_at before update on public.listing_images
  for each row execute function public.set_updated_at();

alter table public.listing_images enable row level security;
revoke all on public.listing_images from anon, authenticated;
grant select on public.listing_images to anon, authenticated;
-- deleted_at is not granted: soft deletes go through delete_listing_image (live-listing photo guard).
grant update (position) on public.listing_images to authenticated;
-- The listings subquery runs under the caller's RLS, so it is true only for publicly visible listings.
create policy listing_images_select_public on public.listing_images for select to anon, authenticated using (
  status = 'passed' and deleted_at is null and exists (select 1 from public.listings l where l.id = listing_id)
);
create policy listing_images_select_owner on public.listing_images for select to authenticated using (public.owns_shop(shop_id));
create policy listing_images_select_admin on public.listing_images for select to authenticated using (public.is_admin());
create policy listing_images_update_owner on public.listing_images for update to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));
create policy listing_images_update_admin on public.listing_images for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── image_checks (job queue + evidence) ─────────────────────────────────────
create table public.image_checks (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.listing_images(id) on delete cascade,
  state public.check_job_state not null default 'queued',
  forced_decision public.image_status,
  attempts smallint not null default 0 check (attempts between 0 and 3),
  locked_at timestamptz,
  last_error text,
  car_check jsonb,
  ai_check jsonb,
  metadata_signals jsonb,
  phash_match jsonb,
  decision public.image_status,
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index image_checks_queue_idx on public.image_checks (state, created_at) where state in ('queued', 'running');
create unique index image_checks_one_open_job_key on public.image_checks (image_id) where state in ('queued', 'running');
create trigger image_checks_set_updated_at before update on public.image_checks
  for each row execute function public.set_updated_at();

alter table public.image_checks enable row level security;
revoke all on public.image_checks from anon, authenticated;
grant select on public.image_checks to authenticated;
create policy image_checks_select_admin on public.image_checks for select to authenticated using (public.is_admin());

-- Owners see only the decision fields of their own photos' jobs.
create view public.image_check_status with (security_barrier = true) as
  select c.image_id, c.state, c.decision, c.decision_reason, c.created_at
    from public.image_checks c
    join public.listing_images i on i.id = c.image_id
   where public.owns_shop(i.shop_id) or public.is_admin();
revoke all on public.image_check_status from anon, authenticated;
grant select on public.image_check_status to authenticated;

-- ── upload_events (60 per shop per rolling 24 h) ────────────────────────────
create table public.upload_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  image_id uuid,
  created_at timestamptz not null default now()
);
create index upload_events_shop_idx on public.upload_events (shop_id, created_at desc);
alter table public.upload_events enable row level security;
revoke all on public.upload_events from anon, authenticated;
grant select on public.upload_events to authenticated;
create policy upload_events_select_owner on public.upload_events for select to authenticated using (public.owns_shop(shop_id));
create policy upload_events_select_admin on public.upload_events for select to authenticated using (public.is_admin());

-- ── Storage ─────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-quarantine', 'listing-quarantine', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('listing-public', 'listing-public', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Quarantine: the owner may create (never overwrite: no UPDATE policy) exactly the object of an
-- `uploaded` photo row, read their own objects (signed thumbnails), and remove objects of photos that
-- were rejected or deleted. Admins read everything. listing-public has no client write policies:
-- only the service-role job runner writes it (INV-I1).
create policy quarantine_insert_owner on storage.objects for insert to authenticated with check (
  bucket_id = 'listing-quarantine' and exists (
    select 1 from public.listing_images i
     where i.quarantine_path = name and i.status = 'uploaded' and i.deleted_at is null and public.owns_shop(i.shop_id)
  )
);
create policy quarantine_select_owner on storage.objects for select to authenticated using (
  bucket_id = 'listing-quarantine' and exists (
    select 1 from public.listing_images i where i.quarantine_path = name and public.owns_shop(i.shop_id)
  )
);
create policy quarantine_select_admin on storage.objects for select to authenticated using (
  bucket_id = 'listing-quarantine' and public.is_admin()
);
create policy quarantine_delete_owner on storage.objects for delete to authenticated using (
  bucket_id = 'listing-quarantine' and exists (
    select 1 from public.listing_images i
     where i.quarantine_path = name and public.owns_shop(i.shop_id) and (i.status = 'rejected' or i.deleted_at is not null)
  )
);

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- request_upload: guards from docs/systems/image-verification.md. Returns the new `uploaded` row.
create or replace function public.request_image_upload(p_listing_id uuid, p_mime_type text, p_bytes int)
returns public.listing_images
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  s public.shops;
  img public.listing_images;
  v_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  -- Serialise uploads per shop so the count and limit checks can't race.
  select * into s from shops where id = l.shop_id for update;
  if s.status = 'suspended' or not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if l.status not in ('draft', 'rejected', 'expired', 'live') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') or p_bytes not between 1 and 10485760 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- Signed upload URLs last 2 h; an `uploaded` row older than that can never complete, so free its slot.
  update listing_images set deleted_at = now()
   where listing_id = l.id and status = 'uploaded' and deleted_at is null and created_at < now() - interval '2 hours';

  if (select count(*) from listing_images where listing_id = l.id and deleted_at is null)
     >= coalesce(setting_num('max_photos'), 20) then
    raise exception 'PHOTO_COUNT' using errcode = 'P0001';
  end if;
  if (select count(*) from upload_events where shop_id = s.id and created_at > now() - interval '24 hours')
     >= coalesce(setting_num('daily_upload_limit'), 60) then
    raise exception 'UPLOAD_LIMIT' using errcode = 'P0001';
  end if;

  insert into listing_images (id, listing_id, shop_id, position, quarantine_path, mime_type, bytes)
  values (
    v_id, l.id, s.id,
    coalesce((select max(position) + 1 from listing_images where listing_id = l.id and deleted_at is null), 0),
    s.id || '/' || l.id || '/' || v_id, p_mime_type, p_bytes
  )
  returning * into img;
  insert into upload_events (shop_id, image_id) values (s.id, v_id);
  return img;
end $$;
revoke execute on function public.request_image_upload(uuid, text, int) from public, anon;
grant execute on function public.request_image_upload(uuid, text, int) to authenticated;

-- complete: the object must exist with the declared size (EC-I1, EC-I2). Idempotent (INV-I4).
-- Returns the photo's status: 'checking' (job queued) or 'rejected' (size mismatch; the caller
-- removes the object and answers 409 UPLOAD_MISSING). Raises UPLOAD_MISSING when there is no object.
create or replace function public.enqueue_image_check(p_image_id uuid)
returns table (image_id uuid, status public.image_status, job_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  img public.listing_images;
  v_size bigint;
  v_job uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into img from listing_images i where i.id = p_image_id for update;
  if not found or img.deleted_at is not null or not owns_shop(img.shop_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if img.status = 'checking' then
    select c.id into v_job from image_checks c where c.image_id = img.id and c.state in ('queued', 'running');
    return query select img.id, img.status, v_job;
    return;
  end if;
  if img.status <> 'uploaded' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;

  select (o.metadata ->> 'size')::bigint into v_size
    from storage.objects o where o.bucket_id = 'listing-quarantine' and o.name = img.quarantine_path;
  if not found then raise exception 'UPLOAD_MISSING' using errcode = 'P0001'; end if;
  if v_size is distinct from img.bytes then
    update listing_images set status = 'rejected', status_reason = 'Upload didn''t match. Please try again.' where id = img.id;
    return query select img.id, 'rejected'::public.image_status, null::uuid;
    return;
  end if;

  insert into image_checks (image_id) values (img.id) returning id into v_job;
  update listing_images set status = 'checking', status_reason = null where id = img.id;
  return query select img.id, 'checking'::public.image_status, v_job;
end $$;
revoke execute on function public.enqueue_image_check(uuid) from public, anon;
grant execute on function public.enqueue_image_check(uuid) to authenticated;

-- owner_delete: soft delete, refusing to leave a live listing with fewer than min_photos passed photos.
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
  return img;
end $$;
revoke execute on function public.delete_listing_image(uuid) from public, anon;
grant execute on function public.delete_listing_image(uuid) to authenticated;
