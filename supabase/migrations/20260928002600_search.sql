-- Issue 026: public search (docs/api-contracts.md → GET /api/listings; INV-L3).
-- Runs as the caller (security invoker), so RLS applies on top of the explicit filters:
-- only live listings of approved shops. Results and the total come back in one call.

create index if not exists listings_live_price_idx on public.listings (price_cents, id) where status = 'live';
create index if not exists listings_live_km_idx on public.listings (odometer_km, id) where status = 'live';
create index if not exists listings_live_year_idx on public.listings (year desc, id) where status = 'live';
create index if not exists listings_live_state_city_idx on public.listings (state, lower(city)) where status = 'live';

create or replace function public.search_listings(
  p_q text default null,
  p_make_id uuid default null,
  p_model_id uuid default null,
  p_price_min bigint default null,
  p_price_max bigint default null,
  p_year_min int default null,
  p_year_max int default null,
  p_km_max int default null,
  p_condition public.car_condition default null,
  p_body_type public.body_type default null,
  p_transmission public.transmission_type default null,
  p_fuel public.fuel_type default null,
  p_state public.ng_state default null,
  p_city text default null,
  p_sort text default 'newest',
  p_page int default 1,
  p_page_size int default 24
) returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select l.id, l.year, l.price_cents, l.currency, l.odometer_km, l.condition, l.body_type, l.transmission, l.fuel,
           l.city, l.state, l.live_at,
           coalesce(nullif(concat_ws(' ', l.year::text, coalesce(l.make_other, mk.name), coalesce(l.model_other, md.name)), ''), 'Untitled car') as title,
           jsonb_build_object('name', s.name, 'slug', s.slug, 'verified', s.verified) as shop,
           (select i.public_paths ->> 'sm' from listing_images i
             where i.listing_id = l.id and i.status = 'passed' and i.deleted_at is null and i.public_paths is not null
             order by i.position limit 1) as thumbnail_path
      from listings l
      join public_shops s on s.id = l.shop_id
      left join vehicle_makes mk on mk.id = l.make_id
      left join vehicle_models md on md.id = l.model_id
     where l.status = 'live'
       and (p_q is null or l.search_vector @@ websearch_to_tsquery('english', p_q))
       and (p_make_id is null or l.make_id = p_make_id)
       and (p_model_id is null or l.model_id = p_model_id)
       and (p_price_min is null or l.price_cents >= p_price_min)
       and (p_price_max is null or l.price_cents <= p_price_max)
       and (p_year_min is null or l.year >= p_year_min)
       and (p_year_max is null or l.year <= p_year_max)
       and (p_km_max is null or l.odometer_km <= p_km_max)
       and (p_condition is null or l.condition = p_condition)
       and (p_body_type is null or l.body_type = p_body_type)
       and (p_transmission is null or l.transmission = p_transmission)
       and (p_fuel is null or l.fuel = p_fuel)
       and (p_state is null or l.state = p_state)
       and (p_city is null or lower(l.city) = lower(btrim(p_city)))
  ),
  ranked as (
    select b.*, row_number() over (order by
      case when p_sort = 'price_asc' then b.price_cents end asc nulls last,
      case when p_sort = 'price_desc' then b.price_cents end desc nulls last,
      case when p_sort = 'km_asc' then b.odometer_km end asc nulls last,
      case when p_sort = 'year_desc' then b.year end desc nulls last,
      case when p_sort not in ('price_asc', 'price_desc', 'km_asc', 'year_desc') then b.live_at end desc nulls last,
      b.id) as rn
      from base b
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(to_jsonb(r) - 'rn' order by r.rn)
        from ranked r
       where r.rn > (greatest(p_page, 1) - 1) * p_page_size and r.rn <= greatest(p_page, 1) * p_page_size
    ), '[]'::jsonb))
$$;
grant execute on function public.search_listings(text, uuid, uuid, bigint, bigint, int, int, int, public.car_condition,
  public.body_type, public.transmission_type, public.fuel_type, public.ng_state, text, text, int, int) to anon, authenticated;
