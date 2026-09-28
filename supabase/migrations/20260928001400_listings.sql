-- Issue 014: listings (docs/schema.md → listings; docs/systems/listing-lifecycle.md BR-L2/L3/L9, INV-L1).
-- Drafts may be incomplete, so car fields are nullable; listings_complete_unless_draft requires them
-- for every other status. Status/version change only through security-definer RPCs (issue 021+).

create type public.body_type as enum ('sedan', 'hatchback', 'suv', 'wagon', 'coupe', 'convertible', 'ute', 'people_mover');
create type public.transmission_type as enum ('automatic', 'manual');
create type public.fuel_type as enum ('petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'lpg');
create type public.listing_status as enum ('draft', 'checking', 'in_review', 'rejected', 'live', 'sold', 'expired', 'removed');
create type public.review_flag as enum ('image_review', 'duplicate_vin', 'other_make_model', 'reports_threshold');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  make_id uuid references public.vehicle_makes(id),
  model_id uuid references public.vehicle_models(id),
  make_other text check (make_other is null or char_length(make_other) between 2 and 40),
  model_other text check (model_other is null or char_length(model_other) between 1 and 40),
  year smallint check (year is null or year >= 1900),
  odometer_km int check (odometer_km is null or odometer_km between 0 and 2000000),
  price_cents bigint check (price_cents is null or price_cents between 100 and 1000000000),
  currency char(3) not null default 'AUD',
  body_type public.body_type,
  transmission public.transmission_type,
  fuel public.fuel_type,
  colour text check (colour is null or char_length(colour) between 2 and 30),
  vin char(17),
  rego text check (rego is null or rego ~ '^[A-Z0-9]{1,9}$'),
  rego_expiry date,
  description text not null default '' check (char_length(description) <= 5000),
  state public.au_state,
  suburb text check (suburb is null or char_length(suburb) between 2 and 60),
  postcode char(4) check (postcode is null or postcode ~ '^[0-9]{4}$'),
  status public.listing_status not null default 'draft',
  status_reason text,
  review_flags public.review_flag[] not null default '{}',
  submitted_at timestamptz,
  live_at timestamptz,
  expires_at timestamptz,
  expiry_reminder_sent_at timestamptz,
  sold_at timestamptz,
  version int not null default 1,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_vin_format check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  constraint listings_make_one_of check (make_id is null or make_other is null),
  constraint listings_model_one_of check (model_id is null or model_other is null),
  constraint listings_postcode_matches_state check (postcode is null or state is null or public.postcode_in_state(postcode, state)),
  constraint listings_complete_unless_draft check (
    status = 'draft' or (
      (make_id is not null or make_other is not null) and (model_id is not null or model_other is not null)
      and year is not null and odometer_km is not null and price_cents is not null
      and body_type is not null and transmission is not null and fuel is not null
      and colour is not null and vin is not null and state is not null and suburb is not null and postcode is not null
    )
  )
);

create unique index listings_live_vin_key on public.listings (vin) where status = 'live';
create index listings_vin_idx on public.listings (vin);
create index listings_search_idx on public.listings (status, live_at desc) where status = 'live';
create index listings_filters_idx on public.listings (make_id, model_id, body_type, state, price_cents, year, odometer_km) where status = 'live';
create index listings_search_vector_idx on public.listings using gin (search_vector);
create index listings_shop_status_idx on public.listings (shop_id, status);
create index listings_expires_idx on public.listings (expires_at) where status = 'live';

create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Year ≤ current year + 1 (not expressible as an immutable CHECK), the model belongs to the make,
-- currency copied from the shop, and the search vector (a generated column can't read make/model names).
create or replace function public.listings_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_make text;
  v_model text;
begin
  if new.year is not null and new.year > extract(year from now())::int + 1 then
    raise exception 'listings_year_range' using errcode = '23514';
  end if;
  if new.make_id is not null and new.model_id is not null
     and not exists (select 1 from vehicle_models where id = new.model_id and make_id = new.make_id) then
    raise exception 'listings_model_make_mismatch' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    select currency into new.currency from shops where id = new.shop_id;
  end if;
  select name into v_make from vehicle_makes where id = new.make_id;
  select name into v_model from vehicle_models where id = new.model_id;
  new.search_vector :=
    setweight(to_tsvector('english', concat_ws(' ', v_make, new.make_other, v_model, new.model_other)), 'A')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'B');
  return new;
end
$$;
create trigger listings_before_write before insert or update on public.listings
  for each row execute function public.listings_before_write();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert (shop_id, make_id, model_id, make_other, model_other, year, odometer_km, price_cents, body_type,
  transmission, fuel, colour, vin, rego, rego_expiry, description, state, suburb, postcode) on public.listings to authenticated;
grant update (make_id, model_id, make_other, model_other, year, odometer_km, price_cents, body_type,
  transmission, fuel, colour, vin, rego, rego_expiry, description, state, suburb, postcode) on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy listings_select_live on public.listings for select to anon, authenticated using (
  status = 'live' and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
);
create policy listings_select_recently_sold on public.listings for select to anon, authenticated using (
  status = 'sold'
  and sold_at > now() - make_interval(days => coalesce(public.setting_num('sold_visible_days'), 7)::int)
  and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
);
create policy listings_select_owner on public.listings for select to authenticated using (public.owns_shop(shop_id));
create policy listings_select_admin on public.listings for select to authenticated using (public.is_admin());
create policy listings_insert_owner on public.listings for insert to authenticated with check (
  status = 'draft' and public.is_active_user()
  and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid() and s.status <> 'suspended')
);
create policy listings_update_owner on public.listings for update to authenticated
  using (public.owns_shop(shop_id) and status <> 'removed') with check (public.owns_shop(shop_id));
create policy listings_update_admin on public.listings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy listings_delete_owner on public.listings for delete to authenticated
  using (public.owns_shop(shop_id) and status = 'draft');
