-- Issue 023: edits on live listings (docs/systems/listing-lifecycle.md → edit_minor, edit_identity,
-- EC-L1 to EC-L4). Minor edits stay live (version++). Identity edits (VIN, make, model, year) go
-- through update_listing_identity, which re-checks the listing.

-- Owners write listings directly (RLS + column grants). This guard enforces the edit rules for those
-- direct writes; security-definer RPCs run as the function owner and are not affected.
create or replace function public.guard_listing_update() returns trigger
language plpgsql set search_path = public as $$
declare
  identity_changed boolean := (new.vin, new.make_id, new.model_id, new.make_other, new.model_other, new.year)
    is distinct from (old.vin, old.make_id, old.model_id, old.make_other, old.model_other, old.year);
  fields_changed boolean := identity_changed or (
    new.odometer_km, new.price_cents, new.condition, new.body_type, new.transmission, new.fuel, new.colour,
    new.rego, new.rego_expiry, new.description, new.state, new.city
  ) is distinct from (
    old.odometer_km, old.price_cents, old.condition, old.body_type, old.transmission, old.fuel, old.colour,
    old.rego, old.rego_expiry, old.description, old.state, old.city
  );
begin
  if current_user <> 'authenticated' or not fields_changed then
    return new;
  end if;
  if old.status in ('checking', 'in_review', 'sold', 'removed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  if old.status = 'live' then
    if identity_changed then
      raise exception 'IDENTITY_EDIT_REQUIRES_RECHECK' using errcode = 'P0001';
    end if;
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create trigger listings_guard_update before update on public.listings
  for each row execute function public.guard_listing_update();

-- live → checking with the new identity (and any other edited fields), then evaluate. The listing
-- keeps its expires_at; a VIN now live elsewhere adds duplicate_vin (→ in_review, EC-L4).
create or replace function public.update_listing_identity(p_listing_id uuid, p_version int, p_fields jsonb)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  s public.shops;
  allowed text[] := array['make_id', 'model_id', 'make_other', 'model_other', 'year', 'odometer_km', 'price_cents',
    'condition', 'body_type', 'transmission', 'fuel', 'colour', 'vin', 'rego', 'rego_expiry', 'description', 'state', 'city'];
  fields jsonb;
  flags public.review_flag[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id for update;
  if not found or not owns_shop(l.shop_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into s from shops where id = l.shop_id;
  if s.status = 'suspended' or not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if l.status <> 'live' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if l.version <> p_version then raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into fields
    from jsonb_each(coalesce(p_fields, '{}'::jsonb)) where key = any (allowed);
  l := jsonb_populate_record(l, fields);

  flags := array(select f from unnest(l.review_flags) f where f <> 'duplicate_vin');
  if exists (select 1 from listings o where o.vin = l.vin and o.id <> l.id and o.status in ('checking', 'in_review', 'live')) then
    flags := flags || 'duplicate_vin'::review_flag;
  end if;
  if (l.make_other is not null or l.model_other is not null) and not ('other_make_model' = any (flags)) then
    flags := flags || 'other_make_model'::review_flag;
  end if;

  update listings
     set make_id = l.make_id, model_id = l.model_id, make_other = l.make_other, model_other = l.model_other,
         year = l.year, odometer_km = l.odometer_km, price_cents = l.price_cents, condition = l.condition,
         body_type = l.body_type, transmission = l.transmission, fuel = l.fuel, colour = l.colour, vin = l.vin,
         rego = l.rego, rego_expiry = l.rego_expiry, description = l.description, state = l.state, city = l.city,
         status = 'checking', status_reason = null, review_flags = flags, version = version + 1
   where id = l.id;
  perform evaluate_listing(l.id);
  select * into l from listings where id = p_listing_id;
  return l;
end $$;
revoke execute on function public.update_listing_identity(uuid, int, jsonb) from public, anon;
grant execute on function public.update_listing_identity(uuid, int, jsonb) to authenticated;
