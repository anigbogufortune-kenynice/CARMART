-- Issue 024: mark sold, and unpublish photos of removed listings and of sold listings past the
-- visible window (docs/systems/listing-lifecycle.md → mark_sold, Unpublishing).

-- live → sold (owner only, optimistic lock).
create or replace function public.mark_listing_sold(p_listing_id uuid, p_version int)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if l.status <> 'live' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if l.version <> p_version then raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;
  update listings set status = 'sold', sold_at = now(), version = version + 1 where id = l.id returning * into l;
  return l;
end $$;
revoke execute on function public.mark_listing_sold(uuid, int) from public, anon;
grant execute on function public.mark_listing_sold(uuid, int) to authenticated;

-- A removed listing's public photos are deleted at once.
create or replace function public.listings_after_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform invoke_internal_job('/api/internal/unpublish-listing', jsonb_build_object('listing_id', new.id));
  return null;
end $$;
create trigger listings_unpublish_removed after update of status on public.listings
  for each row when (new.status = 'removed' and old.status is distinct from 'removed')
  execute function public.listings_after_removed();

-- Daily: sold listings past sold_visible_days that still have public photos. Returns how many.
create or replace function public.unpublish_old_sold() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select l.id from listings l
     where l.status = 'sold'
       and l.sold_at < now() - make_interval(days => coalesce(setting_num('sold_visible_days'), 7)::int)
       and exists (select 1 from listing_images i where i.listing_id = l.id and i.public_paths is not null)
  loop
    perform invoke_internal_job('/api/internal/unpublish-listing', jsonb_build_object('listing_id', r.id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.unpublish_old_sold() from public, anon, authenticated;
grant execute on function public.unpublish_old_sold() to service_role;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('unpublish-old-sold', '15 2 * * *', $cron$ select public.unpublish_old_sold() $cron$);
  end if;
end $$;
