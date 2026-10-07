-- Issue 045: suspensions and listing caps (docs/systems/shop-onboarding.md → suspend, unsuspend,
-- BR-S7, EC-S4, EC-S5; listing-lifecycle EC-L5). Listing states never change: a suspended shop's
-- listings drop out of public view through RLS (only approved shops' listings are public).

create or replace function public.admin_set_shop_suspension(p_shop_id uuid, p_suspend boolean, p_reason text)
returns public.shops
language plpgsql security definer set search_path = public as $$
declare
  s public.shops;
  before_status public.shop_status;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into s from shops where id = p_shop_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  before_status := s.status;
  if p_suspend then
    if s.status not in ('draft', 'pending_approval', 'approved') then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
    update shops set status = 'suspended', status_reason = btrim(p_reason), version = version + 1 where id = s.id returning * into s;
  else
    if s.status <> 'suspended' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
    if exists (select 1 from profiles where id = s.owner_id and status = 'suspended') then
      raise exception 'OWNER_SUSPENDED' using errcode = 'P0001';
    end if;
    update shops set status = 'approved', status_reason = null, approved_at = coalesce(approved_at, now()), version = version + 1
     where id = s.id returning * into s;
  end if;
  perform log_admin_action(case when p_suspend then 'shop.suspend' else 'shop.unsuspend' end, 'shop', s.id::text, btrim(p_reason),
    jsonb_build_object('before', before_status, 'after', s.status));
  return s;
end $$;

-- BR-S7: suspending a user also suspends their shop; unsuspending the user leaves the shop alone.
create or replace function public.admin_set_user_suspension(p_user_id uuid, p_suspend boolean, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  s public.shops;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  select * into p from profiles where id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if (p_suspend and p.status = 'suspended') or (not p_suspend and p.status <> 'suspended') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  update profiles set status = case when p_suspend then 'suspended'::account_status else 'active'::account_status end
   where id = p.id returning * into p;
  perform log_admin_action(case when p_suspend then 'user.suspend' else 'user.unsuspend' end, 'user', p.id::text, btrim(p_reason),
    jsonb_build_object('after', p.status));
  if p_suspend then
    select * into s from shops where owner_id = p.id for update;
    if found and s.status in ('draft', 'pending_approval', 'approved') then
      update shops set status = 'suspended', status_reason = btrim(p_reason), version = version + 1 where id = s.id;
    end if;
  end if;
  return p;
end $$;

create or replace function public.admin_set_listing_cap(p_shop_id uuid, p_cap int, p_reason text) returns public.shops
language plpgsql security definer set search_path = public as $$
declare
  s public.shops;
  before_cap int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_cap is null or p_cap not between 1 and 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into s from shops where id = p_shop_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  before_cap := s.listing_cap;
  update shops set listing_cap = p_cap where id = s.id returning * into s;
  perform log_admin_action('shop.listing_cap', 'shop', s.id::text, btrim(p_reason), jsonb_build_object('before', before_cap, 'after', p_cap));
  return s;
end $$;

revoke execute on function public.admin_set_shop_suspension(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_user_suspension(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_listing_cap(uuid, int, text) from public, anon;
grant execute on function public.admin_set_shop_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_listing_cap(uuid, int, text) to authenticated;
