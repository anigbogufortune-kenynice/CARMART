-- Local/staging seed. Never runs in production (docs/architecture.md → Deployment).

-- Dev admin: admin@carmart.local / admin-password-123
do $$
declare admin_id uuid := '00000000-0000-4000-8000-00000000a001';
begin
  if not exists (select 1 from auth.users where id = admin_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@carmart.local', extensions.crypt('admin-password-123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"Admin"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@carmart.local', 'email_verified', true),
      'email', now(), now(), now());
  end if;
  update public.profiles set role = 'admin' where id = admin_id;
end $$;
