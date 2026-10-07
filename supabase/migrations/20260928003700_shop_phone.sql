-- Issue 037: opt-in seller phone (docs/auth.md → Privacy). The owner's verified phone is returned
-- only for a live listing of an approved shop with show_phone on, and only to signed-in users.
-- Visitors get UNAUTHENTICATED when a number *is* available (so the page can offer sign-in) and
-- PHONE_NOT_AVAILABLE otherwise; they never see the number.
create or replace function public.listing_phone(p_listing_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare phone text;
begin
  select p.phone into phone
    from listings l
    join shops s on s.id = l.shop_id
    join profiles p on p.id = s.owner_id
   where l.id = p_listing_id and l.status = 'live' and s.status = 'approved' and s.show_phone
     and p.phone is not null and p.phone_verified_at is not null;
  if phone is null then raise exception 'PHONE_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  return phone;
end $$;
revoke execute on function public.listing_phone(uuid) from public;
grant execute on function public.listing_phone(uuid) to anon, authenticated;
