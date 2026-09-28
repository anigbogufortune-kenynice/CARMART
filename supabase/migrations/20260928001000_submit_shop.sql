-- Issue 010: draft|rejected → pending_approval (docs/systems/shop-onboarding.md, ADR-011).
create or replace function public.submit_shop() returns public.shops
language plpgsql security definer set search_path = public as $$
declare s public.shops;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into s from public.shops where owner_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status not in ('draft', 'rejected') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and phone_verified_at is not null and status = 'active') then
    raise exception 'PHONE_NOT_VERIFIED' using errcode = 'P0001';
  end if;
  update public.shops
     set status = 'pending_approval', status_reason = null, submitted_at = now(), version = version + 1
   where id = s.id
  returning * into s;
  return s;
end $$;
revoke execute on function public.submit_shop() from public, anon;
grant execute on function public.submit_shop() to authenticated;
