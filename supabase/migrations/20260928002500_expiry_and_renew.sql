-- Issue 025: listing expiry, reminder emails and renewal (docs/systems/listing-lifecycle.md →
-- expire, renew; EC-L6, EC-L7; INV-L5).

-- live → expired once expires_at has passed. in_review listings never expire (EC-L6).
create or replace function public.expire_listings() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update listings set status = 'expired', version = version + 1
   where status = 'live' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_listings() from public, anon, authenticated;
grant execute on function public.expire_listings() to service_role;

-- One listing_expiring email per live period, within expiry_reminder_days of expiry.
create or replace function public.queue_expiry_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select l.id, l.expires_at, s.owner_id
      from listings l join shops s on s.id = l.shop_id
     where l.status = 'live' and l.expiry_reminder_sent_at is null
       and l.expires_at > now()
       and l.expires_at <= now() + make_interval(days => coalesce(setting_num('expiry_reminder_days'), 7)::int)
     for update of l skip locked
  loop
    perform enqueue_notification(r.owner_id, 'listing_expiring', r.id,
      jsonb_build_object('title', listing_title(r.id), 'listingId', r.id, 'expiresAt', r.expires_at));
    update listings set expiry_reminder_sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.queue_expiry_reminders() from public, anon, authenticated;
grant execute on function public.queue_expiry_reminders() to service_role;

-- expired → checking. Same guards as submit (approved shop, photos, cap, VIN), and every photo is
-- checked again. When they pass, evaluate_listing sets a fresh expires_at (it is in the past).
create or replace function public.renew_listing(p_listing_id uuid, p_version int)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  s public.shops;
  n_photos int;
  flags public.review_flag[] := '{}';
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into s from shops where id = l.shop_id for update;
  if l.status <> 'expired' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if l.version <> p_version then raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if s.status <> 'approved' or not is_active_user() then raise exception 'SHOP_NOT_APPROVED' using errcode = 'P0001'; end if;

  update listing_images set deleted_at = now() where listing_id = l.id and status = 'uploaded' and deleted_at is null;
  select count(*) into n_photos from listing_images where listing_id = l.id and deleted_at is null;
  if n_photos < coalesce(setting_num('min_photos'), 4) or n_photos > coalesce(setting_num('max_photos'), 20) then
    raise exception 'PHOTO_COUNT' using errcode = 'P0001';
  end if;
  if (select count(*) from listings where shop_id = s.id and status in ('checking', 'in_review', 'live')) >= s.listing_cap then
    raise exception 'LISTING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  if exists (select 1 from listings where shop_id = s.id and vin = l.vin and id <> l.id and status in ('checking', 'in_review', 'live')) then
    raise exception 'DUPLICATE_LISTING' using errcode = 'P0001';
  end if;
  if exists (select 1 from listings where shop_id <> s.id and vin = l.vin and status in ('checking', 'in_review', 'live')) then
    flags := flags || 'duplicate_vin'::review_flag;
  end if;
  if l.make_other is not null or l.model_other is not null then
    flags := flags || 'other_make_model'::review_flag;
  end if;

  update listing_images set status = 'checking', status_reason = null
   where listing_id = l.id and deleted_at is null;
  insert into image_checks (image_id)
  select i.id from listing_images i
   where i.listing_id = l.id and i.deleted_at is null
     and not exists (select 1 from image_checks c where c.image_id = i.id and c.state in ('queued', 'running'));

  update listings
     set status = 'checking', status_reason = null, review_flags = flags, submitted_at = now(),
         expiry_reminder_sent_at = null, version = version + 1
   where id = l.id;
  perform evaluate_listing(l.id);
  select * into l from listings where id = l.id;
  return l;
end $$;
revoke execute on function public.renew_listing(uuid, int) from public, anon;
grant execute on function public.renew_listing(uuid, int) to authenticated;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('expire-listings', '*/15 * * * *', $cron$ select public.expire_listings() $cron$);
    perform cron.schedule('queue-expiry-reminders', '7 * * * *', $cron$ select public.queue_expiry_reminders() $cron$);
  end if;
end $$;
