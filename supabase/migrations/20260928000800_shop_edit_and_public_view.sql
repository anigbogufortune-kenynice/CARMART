-- Issue 008: slug lock (INV-S5 / BR-S5) and the public shop view.

-- The slug is editable only while draft/rejected and never after the first approval.
create or replace function public.guard_shop_slug() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.slug is distinct from old.slug
     and (old.status not in ('draft', 'rejected') or old.approved_at is not null) then
    raise exception 'SLUG_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger shops_guard_slug before update on public.shops
  for each row execute function public.guard_shop_slug();

-- Public shop data only (approved shops), with the computed verified badge.
-- Owner-only columns (status_reason, listing_cap, show_phone, owner_id…) are not exposed,
-- and the owner's profile is read through the view owner, not the caller.
create or replace view public.public_shops with (security_barrier = true) as
  select s.id, s.name, s.slug, s.description, s.suburb, s.state, s.postcode, s.created_at,
         (p.phone_verified_at is not null) as verified
    from public.shops s
    join public.profiles p on p.id = s.owner_id
   where s.status = 'approved';
revoke all on public.public_shops from public;
grant select on public.public_shops to anon, authenticated;
