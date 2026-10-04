-- Issue 029: saved cars (docs/schema.md → saved_listings; docs/api-contracts.md → saved-listings).

create table public.saved_listings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saved_listings_user_idx on public.saved_listings (user_id, created_at desc);
alter table public.saved_listings enable row level security;
revoke all on public.saved_listings from anon, authenticated;
grant select, delete on public.saved_listings to authenticated;
create policy saved_listings_own_select on public.saved_listings for select to authenticated using (user_id = auth.uid());
create policy saved_listings_own_delete on public.saved_listings for delete to authenticated using (user_id = auth.uid());

-- Publicly visible = live, or sold within sold_visible_days, and the shop is approved (same as the listings RLS).
create or replace function public.listing_is_public(p_listing_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from listings l join shops s on s.id = l.shop_id
     where l.id = p_listing_id and s.status = 'approved'
       and (l.status = 'live'
            or (l.status = 'sold' and l.sold_at > now() - make_interval(days => coalesce(setting_num('sold_visible_days'), 7)::int)))
  )
$$;
revoke execute on function public.listing_is_public(uuid) from public, anon, authenticated;

-- Save a publicly visible listing. Returns true when newly saved, false when it already was.
create or replace function public.save_listing(p_listing_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if not listing_is_public(p_listing_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  insert into saved_listings (user_id, listing_id) values (auth.uid(), p_listing_id) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke execute on function public.save_listing(uuid) from public, anon;
grant execute on function public.save_listing(uuid) to authenticated;

-- The caller's saved cars, newest first. Listings no longer public keep their title but are flagged
-- unavailable (the caller can't read them through RLS any more).
create or replace function public.my_saved_listings(p_page int default 1, p_page_size int default 24) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select sl.listing_id, sl.created_at as saved_at from saved_listings sl where sl.user_id = auth.uid()
  ),
  rows as (
    select m.saved_at, l.id,
           coalesce(nullif(concat_ws(' ', l.year::text, coalesce(l.make_other, mk.name), coalesce(l.model_other, md.name)), ''), 'Untitled car') as title,
           not listing_is_public(l.id) as unavailable,
           l.price_cents, l.currency, l.year, l.odometer_km, l.condition, l.body_type, l.transmission, l.fuel, l.city, l.state, l.live_at,
           jsonb_build_object('name', s.name, 'slug', s.slug,
             'verified', exists (select 1 from profiles p where p.id = s.owner_id and p.phone_verified_at is not null)) as shop,
           (select i.public_paths ->> 'sm' from listing_images i
             where i.listing_id = l.id and i.status = 'passed' and i.deleted_at is null and i.public_paths is not null
             order by i.position limit 1) as thumbnail_path
      from mine m
      join listings l on l.id = m.listing_id
      join shops s on s.id = l.shop_id
      left join vehicle_makes mk on mk.id = l.make_id
      left join vehicle_models md on md.id = l.model_id
  )
  select jsonb_build_object(
    'total', (select count(*) from rows),
    'items', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.saved_at desc)
        from (select * from rows order by saved_at desc
               offset (greatest(p_page, 1) - 1) * p_page_size limit p_page_size) r
    ), '[]'::jsonb))
$$;
revoke execute on function public.my_saved_listings(int, int) from public, anon;
grant execute on function public.my_saved_listings(int, int) to authenticated;
