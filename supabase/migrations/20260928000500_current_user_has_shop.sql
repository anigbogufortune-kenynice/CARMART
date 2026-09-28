-- Issue 005: placeholder so GET /api/profile/me can report has_shop before the shops
-- table exists. Issue 007 replaces this (create or replace) with the real check.
create or replace function public.current_user_has_shop() returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;
revoke execute on function public.current_user_has_shop() from public, anon;
grant execute on function public.current_user_has_shop() to authenticated;
