-- Issue 022: listing status emails (docs/systems/listing-lifecycle.md → Evaluate; ADR-010 outbox).
-- evaluate_listing now enqueues listing_live / listing_rejected / listing_in_review in the same
-- transaction as the status change. listing_in_review is sent once per submission.

-- "{year} {make} {model}" (docs/systems/listing-lifecycle.md → Computed values).
create or replace function public.listing_title(p_listing_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(concat_ws(' ', l.year::text, coalesce(l.make_other, mk.name), coalesce(l.model_other, md.name)), ''), 'Untitled car')
    from listings l
    left join vehicle_makes mk on mk.id = l.make_id
    left join vehicle_models md on md.id = l.model_id
   where l.id = p_listing_id
$$;
revoke execute on function public.listing_title(uuid) from public, anon, authenticated;

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
  if not found or l.status not in ('checking', 'in_review') then return; end if;
  select owner_id into v_owner from shops where id = l.shop_id;
  v_title := listing_title(l.id);

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
