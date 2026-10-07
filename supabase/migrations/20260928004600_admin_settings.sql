-- Issue 046: admin settings (docs/schema.md → app_settings; ADR-009). settings.service validates the
-- ranges and the relations between keys; this RPC checks the caller, applies the change and audits it.
create or replace function public.admin_update_setting(p_key text, p_value jsonb) returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare
  s public.app_settings;
  before_value jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into s from app_settings where key = p_key for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_value is null or jsonb_typeof(p_value) <> 'number' then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  before_value := s.value;
  update app_settings set value = p_value, updated_by = auth.uid() where key = p_key returning * into s;
  perform log_admin_action('settings.update', 'settings', p_key, null, jsonb_build_object('before', before_value, 'after', p_value));
  return s;
end $$;
revoke execute on function public.admin_update_setting(text, jsonb) from public, anon;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
