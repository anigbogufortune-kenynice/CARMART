-- Issue 009: seller phone verification (docs/auth.md; shop-onboarding EC-S1, EC-S2).

-- Mirror a *confirmed* phone from auth.users into profiles (E.164 with '+').
-- A pending change lives in auth.users.phone_change, so the old verified phone
-- stays in place until the new code is verified (EC-S2).
create or replace function public.sync_confirmed_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone_confirmed_at is not null and new.phone is not null and new.phone <> '' then
    update public.profiles
       set phone = case when new.phone like '+%' then new.phone else '+' || new.phone end,
           phone_verified_at = new.phone_confirmed_at
     where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_phone_confirmed
  after update of phone, phone_confirmed_at on auth.users
  for each row execute function public.sync_confirmed_phone();

-- EC-S1: is this number already verified on another account?
create or replace function public.phone_in_use(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where phone = p_phone and phone_verified_at is not null and id <> auth.uid()
  )
$$;
revoke execute on function public.phone_in_use(text) from public, anon;
grant execute on function public.phone_in_use(text) to authenticated;

-- 5 code requests per user per rolling hour (docs/auth.md → Rate limits).
create table public.phone_code_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index phone_code_requests_user_idx on public.phone_code_requests (user_id, created_at desc);
alter table public.phone_code_requests enable row level security;
revoke all on public.phone_code_requests from anon, authenticated;

-- Records the request and returns true, or returns false (and records nothing) when over the limit.
create or replace function public.record_phone_code_request() returns boolean
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if auth.uid() is null then return false; end if;
  select count(*) into recent from public.phone_code_requests
   where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if recent >= 5 then return false; end if;
  insert into public.phone_code_requests (user_id) values (auth.uid());
  return true;
end $$;
revoke execute on function public.record_phone_code_request() from public, anon;
grant execute on function public.record_phone_code_request() to authenticated;
