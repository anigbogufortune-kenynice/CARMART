-- Issue 012: admin shop decisions + internal job wiring (pg_net, pg_cron, Vault).

-- ── extensions (Supabase ships both; guarded so the migration applies anywhere) ──
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;

-- ── internal job invocation ────────────────────────────────────────────────
-- The app URL and bearer secret live in Vault (docs/env.md). Until they are
-- configured this is a no-op, so local stacks without the app running don't error.
create or replace function public.invoke_internal_job(p_path text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'internal_job_secret' limit 1;
  if base_url is null or secret is null then
    return null;
  end if;
  select net.http_post(
    url := rtrim(base_url, '/') || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret)
  ) into request_id;
  return request_id;
end $$;
revoke execute on function public.invoke_internal_job(text) from public, anon, authenticated;
grant execute on function public.invoke_internal_job(text) to service_role;

-- One call to set (or rotate) both Vault secrets. Service role only.
create or replace function public.configure_internal_jobs(p_base_url text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare existing uuid;
begin
  if p_base_url !~ '^https?://' then raise exception 'VALIDATION_ERROR: base url must be http(s)' using errcode = 'P0001'; end if;
  if char_length(p_secret) < 32 then raise exception 'VALIDATION_ERROR: secret must be 32+ characters' using errcode = 'P0001'; end if;
  select id into existing from vault.secrets where name = 'app_base_url';
  if existing is null then perform vault.create_secret(p_base_url, 'app_base_url');
  else perform vault.update_secret(existing, p_base_url); end if;
  select id into existing from vault.secrets where name = 'internal_job_secret';
  if existing is null then perform vault.create_secret(p_secret, 'internal_job_secret');
  else perform vault.update_secret(existing, p_secret); end if;
end $$;
revoke execute on function public.configure_internal_jobs(text, text) from public, anon, authenticated;
grant execute on function public.configure_internal_jobs(text, text) to service_role;

-- Dispatch emails as soon as something is queued (the cron job below is the safety net).
create or replace function public.notifications_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.invoke_internal_job('/api/internal/dispatch-notifications');
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  for each statement execute function public.notifications_after_insert();

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('dispatch-notifications', '* * * * *',
      $cron$ select public.invoke_internal_job('/api/internal/dispatch-notifications') $cron$);
  end if;
end $$;

-- ── admin shop decisions (docs/systems/shop-onboarding.md) ─────────────────
create or replace function public.admin_approve_shop(p_shop_id uuid) returns public.shops
language plpgsql security definer set search_path = public as $$
declare s public.shops;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into s from public.shops where id = p_shop_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status <> 'pending_approval' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  update public.shops
     set status = 'approved', status_reason = null, approved_at = coalesce(approved_at, now()), version = version + 1
   where id = s.id
  returning * into s;
  perform public.log_admin_action('shop.approve', 'shop', s.id::text, null, jsonb_build_object('before', 'pending_approval', 'after', 'approved'));
  perform public.enqueue_notification(s.owner_id, 'shop_approved', s.id, jsonb_build_object('shopName', s.name, 'slug', s.slug));
  return s;
end $$;

create or replace function public.admin_reject_shop(p_shop_id uuid, p_reason text) returns public.shops
language plpgsql security definer set search_path = public as $$
declare s public.shops;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into s from public.shops where id = p_shop_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status <> 'pending_approval' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  update public.shops
     set status = 'rejected', status_reason = btrim(p_reason), version = version + 1
   where id = s.id
  returning * into s;
  perform public.log_admin_action('shop.reject', 'shop', s.id::text, btrim(p_reason), jsonb_build_object('before', 'pending_approval', 'after', 'rejected'));
  perform public.enqueue_notification(s.owner_id, 'shop_rejected', s.id, jsonb_build_object('shopName', s.name, 'reason', btrim(p_reason)));
  return s;
end $$;

revoke execute on function public.admin_approve_shop(uuid) from public, anon;
revoke execute on function public.admin_reject_shop(uuid, text) from public, anon;
grant execute on function public.admin_approve_shop(uuid) to authenticated;
grant execute on function public.admin_reject_shop(uuid, text) to authenticated;
