-- Issue 002: foundation schema (docs/schema.md: profiles, admin_actions, app_settings, notifications).

create type public.user_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'suspended');

-- ── updated_at helper ───────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  phone text,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(name, split_part(coalesce(new.email, 'user'), '@', 1)), 60));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

-- Only admins may change status; nobody changes role through the API (no column grant).
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status
     and current_user = 'authenticated' and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.guard_profile_update();

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, status) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── app_settings ────────────────────────────────────────────────────────────
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select, update on public.app_settings to authenticated;
create policy app_settings_admin_select on public.app_settings for select to authenticated using (public.is_admin());
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values
  ('ai_reject_threshold', '0.9'), ('ai_review_threshold', '0.5'),
  ('car_reject_confidence', '0.85'), ('car_pass_confidence', '0.8'),
  ('phash_max_distance', '6'), ('listing_expiry_days', '60'), ('sold_visible_days', '7'),
  ('expiry_reminder_days', '7'), ('reports_auto_hide_count', '3'),
  ('max_photos', '20'), ('min_photos', '4'), ('daily_upload_limit', '60'),
  ('daily_conversation_limit', '20'), ('daily_report_limit', '10');

create or replace function public.setting_num(p_key text) returns numeric
language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::numeric from public.app_settings where key = p_key
$$;

-- ── admin_actions (append-only audit log) ───────────────────────────────────
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,               -- no FK: the audit trail must survive account deletion
  action text not null check (char_length(action) between 3 and 60),
  target_type text not null,
  target_id text not null,
  reason text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;
create policy admin_actions_admin_select on public.admin_actions for select to authenticated using (public.is_admin());

create or replace function public.admin_actions_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'APPEND_ONLY: admin_actions rows cannot be changed or deleted' using errcode = 'P0001';
end $$;
create trigger admin_actions_no_update before update or delete on public.admin_actions
  for each row execute function public.admin_actions_append_only();

-- Write one audit row (called by security-definer admin RPCs in later migrations).
create or replace function public.log_admin_action(
  p_action text, p_target_type text, p_target_id text, p_reason text default null, p_details jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_reason, coalesce(p_details, '{}'))
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.log_admin_action(text, text, text, text, jsonb) from public, anon, authenticated;

-- ── notifications (email outbox, ADR-010) ──────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ref_id uuid,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_pending_idx on public.notifications (status, created_at) where status = 'pending';
create index notifications_dedupe_idx on public.notifications (user_id, kind, ref_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

create or replace function public.enqueue_notification(
  p_user uuid, p_kind text, p_ref uuid, p_payload jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if p_kind = 'new_message' and exists (
    select 1 from public.notifications
    where user_id = p_user and kind = 'new_message' and ref_id is not distinct from p_ref
      and created_at > now() - interval '15 minutes'
  ) then
    return null;
  end if;
  insert into public.notifications (user_id, kind, ref_id, payload)
  values (p_user, p_kind, p_ref, coalesce(p_payload, '{}'))
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.enqueue_notification(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_notification(uuid, text, uuid, jsonb) to service_role;
