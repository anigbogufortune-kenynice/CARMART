-- Issue 020: photo reordering. Positions only need to be unique among non-deleted photos, and
-- repeated upload/delete cycles leave gaps, so drop the 0–99 cap (reordering compacts to 0..n-1).
alter table public.listing_images drop constraint if exists listing_images_position_check;
alter table public.listing_images add constraint listing_images_position_check check (position >= 0);

-- The new order must name exactly the listing's non-deleted photos. Two phases, because the
-- partial unique index on (listing_id, position) can't be deferred.
create or replace function public.reorder_listing_images(p_listing_id uuid, p_image_ids uuid[])
returns setof public.listing_images
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  current_ids uuid[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select coalesce(array_agg(id order by id), '{}') into current_ids
    from listing_images where listing_id = l.id and deleted_at is null;
  if cardinality(p_image_ids) <> cardinality(current_ids)
     or (select array_agg(x order by x) from unnest(p_image_ids) x) is distinct from current_ids then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  update listing_images set position = position + 10000 where listing_id = l.id and deleted_at is null;
  update listing_images i
     set position = o.ord - 1
    from unnest(p_image_ids) with ordinality as o(id, ord)
   where i.id = o.id;
  return query select * from listing_images where listing_id = l.id and deleted_at is null order by position;
end $$;
revoke execute on function public.reorder_listing_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_listing_images(uuid, uuid[]) to authenticated;
