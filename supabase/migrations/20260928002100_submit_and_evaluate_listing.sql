-- Issue 021: submit a listing and evaluate it (docs/systems/listing-lifecycle.md → submit,
-- Evaluate rules 1–4, INV-L1 to INV-L6, BR-L1, BR-L4 to BR-L8, BR-L10, BR-L11, EC-L11).

-- evaluate_listing replaces the issue-018 placeholder. Only `checking`/`in_review` listings move.
create or replace function public.evaluate_listing(p_listing_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  n_rejected int;
  n_pending int;
  n_review int;
  n_passed int;
begin
  select * into l from listings where id = p_listing_id for update;
  if not found or l.status not in ('checking', 'in_review') then return; end if;

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
    end if;
    return;
  end if;

  -- Photos deleted while checking can leave too few (INV-L2): send it back to the seller.
  if n_passed < coalesce(setting_num('min_photos'), 4) then
    update listings set status = 'rejected', status_reason = 'A listing needs at least 4 approved photos', version = version + 1
     where id = l.id;
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
end $$;

create or replace function public.submit_listing(p_listing_id uuid, p_version int)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  s public.shops;
  missing text[] := '{}';
  n_photos int;
  flags public.review_flag[] := '{}';
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  -- The shop row lock serialises submits per shop, so two can't both take the last slot (EC-L11).
  select * into s from shops where id = l.shop_id for update;
  if l.status not in ('draft', 'rejected') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if l.version <> p_version then raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if s.status <> 'approved' or not is_active_user() then raise exception 'SHOP_NOT_APPROVED' using errcode = 'P0001'; end if;

  -- BR-L1: required fields.
  if l.make_id is null and l.make_other is null then missing := array_append(missing, 'make'); end if;
  if l.model_id is null and l.model_other is null then missing := array_append(missing, 'model'); end if;
  if l.year is null then missing := array_append(missing, 'year'); end if;
  if l.odometer_km is null then missing := array_append(missing, 'odometer_km'); end if;
  if l.price_cents is null then missing := array_append(missing, 'price'); end if;
  if l.body_type is null then missing := array_append(missing, 'body_type'); end if;
  if l.transmission is null then missing := array_append(missing, 'transmission'); end if;
  if l.fuel is null then missing := array_append(missing, 'fuel'); end if;
  if l.colour is null then missing := array_append(missing, 'colour'); end if;
  if l.vin is null then missing := array_append(missing, 'vin'); end if;
  if l.state is null then missing := array_append(missing, 'state'); end if;
  if l.suburb is null then missing := array_append(missing, 'suburb'); end if;
  if l.postcode is null then missing := array_append(missing, 'postcode'); end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;

  -- Unconfirmed uploads can never complete a check: drop them before counting (BR-L4).
  update listing_images set deleted_at = now() where listing_id = l.id and status = 'uploaded' and deleted_at is null;
  select count(*) into n_photos from listing_images where listing_id = l.id and deleted_at is null;
  if n_photos < coalesce(setting_num('min_photos'), 4) or n_photos > coalesce(setting_num('max_photos'), 20) then
    raise exception 'PHOTO_COUNT' using errcode = 'P0001';
  end if;

  -- BR-L5 / INV-L5: active listings stay within the cap.
  if (select count(*) from listings where shop_id = s.id and status in ('checking', 'in_review', 'live')) >= s.listing_cap then
    raise exception 'LISTING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  -- BR-L6: this shop already has the car active.
  if exists (select 1 from listings where shop_id = s.id and vin = l.vin and id <> l.id and status in ('checking', 'in_review', 'live')) then
    raise exception 'DUPLICATE_LISTING' using errcode = 'P0001';
  end if;
  -- BR-L7 / BR-L8: flags for the admin.
  if exists (select 1 from listings where shop_id <> s.id and vin = l.vin and status in ('checking', 'in_review', 'live')) then
    flags := flags || 'duplicate_vin'::review_flag;
  end if;
  if l.make_other is not null or l.model_other is not null then
    flags := flags || 'other_make_model'::review_flag;
  end if;

  -- Safety net: a photo shown as checking without an open job gets one.
  insert into image_checks (image_id)
  select i.id from listing_images i
   where i.listing_id = l.id and i.deleted_at is null and i.status = 'checking'
     and not exists (select 1 from image_checks c where c.image_id = i.id and c.state in ('queued', 'running'));

  update listings
     set status = 'checking', status_reason = null, review_flags = flags, submitted_at = now(), version = version + 1
   where id = l.id;
  perform evaluate_listing(l.id);
  select * into l from listings where id = l.id;
  return l;
end $$;
revoke execute on function public.submit_listing(uuid, int) from public, anon;
grant execute on function public.submit_listing(uuid, int) to authenticated;
