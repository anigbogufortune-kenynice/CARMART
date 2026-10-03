-- ADR-015: CarMart serves Nigeria (was Australia). Converts the schema in place:
--   • states: the 36 states + FCT (enum ng_state replaces au_state)
--   • no postcode (rarely used in Nigeria): columns, checks and postcode_in_state() removed
--   • suburb → city; country NG; currency NGN (prices stored in kobo, ₦1,000 – ₦10bn)
--   • plate numbers up to 10 letters/digits; body type 'ute' → 'pickup'; fuel adds CNG
--   • listings gain condition: brand new / foreign used (tokunbo) / Nigerian used
-- No production data existed when this ran (fresh project), so values are converted by cast.

-- ── drop everything that depends on state/postcode/suburb ───────────────────
drop view if exists public.public_shops;
alter table public.shops drop constraint if exists shops_postcode_matches_state;
alter table public.listings drop constraint if exists listings_postcode_matches_state;
alter table public.listings drop constraint if exists listings_complete_unless_draft;
drop function if exists public.postcode_in_state(text, public.au_state);

-- ── states ──────────────────────────────────────────────────────────────────
alter table public.shops alter column state type text;
alter table public.listings alter column state type text;
drop type public.au_state;
create type public.ng_state as enum (
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
);
alter table public.shops alter column state type public.ng_state using state::public.ng_state;
alter table public.listings alter column state type public.ng_state using state::public.ng_state;

-- ── postcode out, suburb → city ─────────────────────────────────────────────
alter table public.shops drop column postcode;
alter table public.listings drop column postcode;
alter table public.shops rename column suburb to city;
alter table public.listings rename column suburb to city;
alter table public.shops rename constraint shops_suburb_check to shops_city_check;
alter table public.listings rename constraint listings_suburb_check to listings_city_check;

-- ── country and currency ───────────────────────────────────────────────────
alter table public.shops alter column country set default 'NG';
alter table public.shops alter column currency set default 'NGN';
alter table public.listings alter column currency set default 'NGN';
update public.shops set country = 'NG', currency = 'NGN';
update public.listings set currency = 'NGN';

-- Prices in kobo: ₦1,000 to ₦10,000,000,000.
alter table public.listings drop constraint listings_price_cents_check;
alter table public.listings add constraint listings_price_cents_check
  check (price_cents is null or price_cents between 100000 and 1000000000000);

-- Nigerian plate numbers (e.g. LND-123-AA → LND123AA): up to 10 letters and digits.
alter table public.listings drop constraint listings_rego_check;
alter table public.listings add constraint listings_rego_check check (rego is null or rego ~ '^[A-Z0-9]{1,10}$');

-- ── vehicle vocabulary ─────────────────────────────────────────────────────
alter type public.body_type rename value 'ute' to 'pickup';
alter type public.fuel_type add value if not exists 'cng';
create type public.car_condition as enum ('brand_new', 'foreign_used', 'nigerian_used');
alter table public.listings add column condition public.car_condition;

-- Outside draft every car field is required (postcode gone, condition added).
alter table public.listings add constraint listings_complete_unless_draft check (
  status = 'draft' or (
    (make_id is not null or make_other is not null) and (model_id is not null or model_other is not null)
    and year is not null and odometer_km is not null and price_cents is not null and condition is not null
    and body_type is not null and transmission is not null and fuel is not null
    and colour is not null and vin is not null and state is not null and city is not null
  )
);

-- Column grants follow the renamed/new columns.
revoke insert, update on public.shops from authenticated;
grant insert (owner_id, name, slug, description, city, state) on public.shops to authenticated;
grant update (name, slug, description, city, state, show_phone) on public.shops to authenticated;
revoke insert, update on public.listings from authenticated;
grant insert (shop_id, make_id, model_id, make_other, model_other, year, odometer_km, price_cents, condition, body_type,
  transmission, fuel, colour, vin, rego, rego_expiry, description, state, city) on public.listings to authenticated;
grant update (make_id, model_id, make_other, model_other, year, odometer_km, price_cents, condition, body_type,
  transmission, fuel, colour, vin, rego, rego_expiry, description, state, city) on public.listings to authenticated;

-- Public shop view (extends issue 008) without postcode.
create view public.public_shops with (security_barrier = true) as
  select s.id, s.name, s.slug, s.description, s.city, s.state, s.created_at,
         (p.phone_verified_at is not null) as verified
    from public.shops s
    join public.profiles p on p.id = s.owner_id
   where s.status = 'approved';
revoke all on public.public_shops from public;
grant select on public.public_shops to anon, authenticated;

-- ── submit_listing (extends issue 021): condition required, no postcode ─────
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
  select * into s from shops where id = l.shop_id for update;
  if l.status not in ('draft', 'rejected') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if l.version <> p_version then raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;
  if s.status <> 'approved' or not is_active_user() then raise exception 'SHOP_NOT_APPROVED' using errcode = 'P0001'; end if;

  if l.make_id is null and l.make_other is null then missing := array_append(missing, 'make'); end if;
  if l.model_id is null and l.model_other is null then missing := array_append(missing, 'model'); end if;
  if l.year is null then missing := array_append(missing, 'year'); end if;
  if l.condition is null then missing := array_append(missing, 'condition'); end if;
  if l.odometer_km is null then missing := array_append(missing, 'odometer_km'); end if;
  if l.price_cents is null then missing := array_append(missing, 'price'); end if;
  if l.body_type is null then missing := array_append(missing, 'body_type'); end if;
  if l.transmission is null then missing := array_append(missing, 'transmission'); end if;
  if l.fuel is null then missing := array_append(missing, 'fuel'); end if;
  if l.colour is null then missing := array_append(missing, 'colour'); end if;
  if l.vin is null then missing := array_append(missing, 'vin'); end if;
  if l.state is null then missing := array_append(missing, 'state'); end if;
  if l.city is null then missing := array_append(missing, 'city'); end if;
  if cardinality(missing) > 0 then
    raise exception 'LISTING_INCOMPLETE: %', array_to_string(missing, ', ') using errcode = 'P0001';
  end if;

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

-- ── makes and models for the Nigerian market ───────────────────────────────
-- Australia-only makes/models out (no listings referenced them yet).
delete from public.vehicle_makes where name in ('Holden', 'Abarth', 'Cupra', 'Polestar', 'Zeekr', 'Smart', 'Ram');
delete from public.vehicle_models m using public.vehicle_makes k
 where m.make_id = k.id and (k.name, m.name) in (
   ('Ford', 'Falcon'), ('Ford', 'Falcon Ute'), ('Ford', 'Territory'), ('Ford', 'Endura'),
   ('Toyota', 'Aurion'), ('Toyota', 'Tarago'), ('Mitsubishi', '380'), ('Mitsubishi', 'Magna'),
   ('Mitsubishi', 'Express Wagon'), ('LDV', 'Deliver 9 Bus'), ('LDV', 'eDeliver 9 Bus'),
   ('Renault', 'Trafic Crew Cab'), ('Renault', 'Kangoo Maxi Crew'), ('Hyundai', 'iMax'), ('Hyundai', 'iLoad')
 );

insert into public.vehicle_makes (name) values
  ('Acura'), ('Infiniti'), ('Innoson'), ('Changan'), ('Geely'), ('GAC'), ('JAC'), ('Jetour'), ('Pontiac')
on conflict (name) do nothing;

insert into public.vehicle_models (make_id, name)
select mk.id, v.model from (values
  ('Acura', 'MDX'), ('Acura', 'RDX'), ('Acura', 'TLX'), ('Acura', 'TL'), ('Acura', 'ZDX'), ('Acura', 'ILX'),
  ('Infiniti', 'FX35'), ('Infiniti', 'G35'), ('Infiniti', 'Q50'), ('Infiniti', 'QX50'), ('Infiniti', 'QX56'),
  ('Infiniti', 'QX60'), ('Infiniti', 'QX80'),
  ('Innoson', 'IVM G5'), ('Innoson', 'IVM G40'), ('Innoson', 'IVM Fox'), ('Innoson', 'IVM Umu'),
  ('Innoson', 'IVM Carrier'), ('Innoson', 'IVM Connect'),
  ('Changan', 'Alsvin'), ('Changan', 'CS15'), ('Changan', 'CS35 Plus'), ('Changan', 'CS55'), ('Changan', 'CS75'),
  ('Changan', 'CS85'), ('Changan', 'Eado'), ('Changan', 'Hunter'), ('Changan', 'Uni-K'), ('Changan', 'Uni-T'),
  ('Geely', 'Azkarra'), ('Geely', 'Coolray'), ('Geely', 'Emgrand'), ('Geely', 'Monjaro'), ('Geely', 'Okavango'),
  ('Geely', 'Tugella'),
  ('GAC', 'GA4'), ('GAC', 'GA8'), ('GAC', 'GS3'), ('GAC', 'GS4'), ('GAC', 'GS8'), ('GAC', 'GN6'), ('GAC', 'GN8'),
  ('JAC', 'J7'), ('JAC', 'JS2'), ('JAC', 'JS4'), ('JAC', 'JS6'), ('JAC', 'JS8'), ('JAC', 'T6'), ('JAC', 'T8'),
  ('Jetour', 'Dashing'), ('Jetour', 'T2'), ('Jetour', 'X70'), ('Jetour', 'X90'),
  ('Pontiac', 'Vibe'), ('Pontiac', 'G6'),
  ('Toyota', 'Avalon'), ('Toyota', 'Avensis'), ('Toyota', 'Sienna'), ('Toyota', 'Venza'), ('Toyota', 'Highlander'),
  ('Toyota', 'Matrix'), ('Toyota', 'Sequoia'), ('Toyota', 'Tundra'), ('Toyota', '4Runner'), ('Toyota', 'Hiace'),
  ('Toyota', 'Land Cruiser Prado'), ('Toyota', 'Camry Hybrid'), ('Toyota', 'Solara'),
  ('Honda', 'Pilot'), ('Honda', 'Element'), ('Honda', 'Crosstour'), ('Honda', 'Ridgeline'), ('Honda', 'Passport'),
  ('Lexus', 'GX 460'), ('Lexus', 'LX 570'), ('Lexus', 'RX 350'), ('Lexus', 'ES 350'), ('Lexus', 'IS 250'),
  ('Hyundai', 'Creta'), ('Hyundai', 'Azera'),
  ('Kia', 'Sonet'), ('Kia', 'K5'), ('Kia', 'Mohave'),
  ('Nissan', 'Almera'), ('Nissan', 'Sentra'), ('Nissan', 'Altima'), ('Nissan', 'Maxima'), ('Nissan', 'Armada'),
  ('Nissan', 'Rogue'), ('Nissan', 'Frontier'),
  ('Mercedes-Benz', 'ML'), ('Mercedes-Benz', 'GL'), ('Mercedes-Benz', 'GLK'), ('Mercedes-Benz', 'Sprinter'),
  ('Ford', 'Explorer'), ('Ford', 'Edge'), ('Ford', 'Expedition'), ('Ford', 'Fusion'),
  ('Peugeot', '301'), ('Peugeot', '406'), ('Peugeot', '407'), ('Peugeot', '607'), ('Peugeot', 'Partner'),
  ('Volkswagen', 'Sharan'), ('Volkswagen', 'Touran'), ('Volkswagen', 'Golf Variant'),
  ('Mitsubishi', 'L200'), ('Mitsubishi', 'Galant'),
  ('Land Rover', 'LR4'), ('Land Rover', 'LR3'),
  ('Jeep', 'Liberty'),
  ('Chevrolet', 'Cruze'), ('Chevrolet', 'Malibu'), ('Chevrolet', 'Equinox'), ('Chevrolet', 'Traverse'),
  ('Chevrolet', 'Tahoe'), ('Chevrolet', 'Captiva'),
  ('Dodge', 'Charger'), ('Dodge', 'Durango'), ('Dodge', 'Ram')
) as v(make, model)
join public.vehicle_makes mk on mk.name = v.make
on conflict (make_id, name) do nothing;
