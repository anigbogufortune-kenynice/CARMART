-- Issue 042: admin listing actions (docs/systems/listing-lifecycle.md → admin_clear_flag,
-- admin_reject, admin_remove; INV-L1, INV-L7, EC-L8). Each writes an audit row.

-- Remove one review flag, then re-evaluate (→ live when nothing else holds it).
create or replace function public.admin_clear_listing_flag(p_listing_id uuid, p_flag public.review_flag, p_reason text default null)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (p_flag = any (l.review_flags)) then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if p_flag = 'duplicate_vin'
     and exists (select 1 from listings o where o.vin = l.vin and o.id <> l.id and o.status = 'live') then
    raise exception 'VIN_STILL_LIVE' using errcode = 'P0001';
  end if;
  update listings set review_flags = array_remove(review_flags, p_flag) where id = l.id;
  perform log_admin_action('listing.clear_flag', 'listing', l.id::text, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('flag', p_flag, 'status', l.status));
  perform evaluate_listing(l.id);
  select * into l from listings where id = p_listing_id;
  return l;
end $$;

-- in_review → rejected (the seller can fix and resubmit); flags are cleared.
create or replace function public.admin_reject_listing(p_listing_id uuid, p_reason text) returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into l from listings where id = p_listing_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if l.status <> 'in_review' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  update listings set status = 'rejected', status_reason = btrim(p_reason), review_flags = '{}', version = version + 1
   where id = l.id returning * into l;
  select owner_id into v_owner from shops where id = l.shop_id;
  perform log_admin_action('listing.reject', 'listing', l.id::text, btrim(p_reason),
    jsonb_build_object('before', 'in_review', 'after', 'rejected'));
  perform enqueue_notification(v_owner, 'listing_rejected', l.id, jsonb_build_object(
    'title', listing_title(l.id), 'listingId', l.id, 'reason', btrim(p_reason), 'photos', '[]'::jsonb));
  return l;
end $$;

-- Any state except removed → removed (terminal, INV-L7). The status trigger from issue 024
-- unpublishes the photos; the seller is emailed the reason.
create or replace function public.admin_remove_listing(p_listing_id uuid, p_reason text) returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  before_status public.listing_status;
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into l from listings where id = p_listing_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if l.status = 'removed' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  before_status := l.status;
  update listings set status = 'removed', status_reason = btrim(p_reason), review_flags = '{}', version = version + 1
   where id = l.id returning * into l;
  select owner_id into v_owner from shops where id = l.shop_id;
  perform log_admin_action('listing.remove', 'listing', l.id::text, btrim(p_reason),
    jsonb_build_object('before', before_status, 'after', 'removed'));
  perform enqueue_notification(v_owner, 'listing_removed', l.id, jsonb_build_object(
    'title', listing_title(l.id), 'listingId', l.id, 'reason', btrim(p_reason)));
  return l;
end $$;

revoke execute on function public.admin_clear_listing_flag(uuid, public.review_flag, text) from public, anon;
revoke execute on function public.admin_reject_listing(uuid, text) from public, anon;
revoke execute on function public.admin_remove_listing(uuid, text) from public, anon;
grant execute on function public.admin_clear_listing_flag(uuid, public.review_flag, text) to authenticated;
grant execute on function public.admin_reject_listing(uuid, text) to authenticated;
grant execute on function public.admin_remove_listing(uuid, text) to authenticated;
