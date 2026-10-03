-- Hosting on Netlify (ADR-014): photo checks need `sharp`, which Netlify supports in plain
-- Netlify Functions but not inside the Next.js server, so production runs them in the background
-- function `process-image-checks`. The path Postgres calls is a Vault setting; without it the
-- Next.js route is used (local stacks and CI).

drop function if exists public.configure_internal_jobs(text, text);

create or replace function public.configure_internal_jobs(p_base_url text, p_secret text, p_image_check_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare existing uuid;
begin
  if p_base_url !~ '^https?://' then raise exception 'VALIDATION_ERROR: base url must be http(s)' using errcode = 'P0001'; end if;
  if char_length(p_secret) < 32 then raise exception 'VALIDATION_ERROR: secret must be 32+ characters' using errcode = 'P0001'; end if;
  if p_image_check_path is not null and p_image_check_path !~ '^/[A-Za-z0-9/_.-]+$' then
    raise exception 'VALIDATION_ERROR: image check path must start with /' using errcode = 'P0001';
  end if;
  select id into existing from vault.secrets where name = 'app_base_url';
  if existing is null then perform vault.create_secret(p_base_url, 'app_base_url');
  else perform vault.update_secret(existing, p_base_url); end if;
  select id into existing from vault.secrets where name = 'internal_job_secret';
  if existing is null then perform vault.create_secret(p_secret, 'internal_job_secret');
  else perform vault.update_secret(existing, p_secret); end if;
  select id into existing from vault.secrets where name = 'image_check_path';
  if p_image_check_path is not null then
    if existing is null then perform vault.create_secret(p_image_check_path, 'image_check_path');
    else perform vault.update_secret(existing, p_image_check_path); end if;
  elsif existing is not null then
    delete from vault.secrets where id = existing;
  end if;
end $$;
revoke execute on function public.configure_internal_jobs(text, text, text) from public, anon, authenticated;
grant execute on function public.configure_internal_jobs(text, text, text) to service_role;

create or replace function public.image_check_job_path() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'image_check_path' limit 1),
    '/api/internal/process-image-checks'
  )
$$;
revoke execute on function public.image_check_job_path() from public, anon, authenticated;
grant execute on function public.image_check_job_path() to service_role;

-- Extends the issue-018 trigger function.
create or replace function public.image_checks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.invoke_internal_job(public.image_check_job_path());
  return null;
end $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('process-image-checks', '* * * * *',
      $cron$ select public.invoke_internal_job(public.image_check_job_path()) $cron$);
  end if;
end $$;
