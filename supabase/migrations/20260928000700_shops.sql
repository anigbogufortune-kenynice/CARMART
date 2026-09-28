-- Issue 007: shops (docs/schema.md → shops; docs/systems/shop-onboarding.md).
create type public.shop_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'suspended');
create type public.au_state as enum ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null check (char_length(slug) between 3 and 50 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 1000),
  suburb text not null check (char_length(suburb) between 2 and 60),
  state public.au_state not null,
  postcode char(4) not null check (postcode ~ '^[0-9]{4}$'),
  country char(2) not null default 'AU',
  currency char(3) not null default 'AUD',
  status public.shop_status not null default 'draft',
  status_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  plan text not null default 'free' check (plan in ('free')),
  listing_cap int not null default 10 check (listing_cap between 1 and 1000),
  show_phone boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_owner_id_key unique (owner_id),
  constraint shops_slug_key unique (slug)
);
create index shops_status_idx on public.shops (status, submitted_at);
create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- Postcode must belong to the state (same ranges as src/lib/au-postcode.ts).
create or replace function public.postcode_in_state(p_postcode text, p_state public.au_state) returns boolean
language sql immutable as $$
  select case p_state
    when 'NSW' then p_postcode::int between 1000 and 2599 or p_postcode::int between 2619 and 2899 or p_postcode::int between 2921 and 2999
    when 'ACT' then p_postcode::int between 200 and 299 or p_postcode::int between 2600 and 2618 or p_postcode::int between 2900 and 2920
    when 'VIC' then p_postcode::int between 3000 and 3999 or p_postcode::int between 8000 and 8999
    when 'QLD' then p_postcode::int between 4000 and 4999 or p_postcode::int between 9000 and 9999
    when 'SA' then p_postcode::int between 5000 and 5999
    when 'WA' then p_postcode::int between 6000 and 6999
    when 'TAS' then p_postcode::int between 7000 and 7999
    when 'NT' then p_postcode::int between 800 and 999
  end
$$;
alter table public.shops add constraint shops_postcode_matches_state check (public.postcode_in_state(postcode, state));

create or replace function public.owns_shop(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid())
$$;

-- Replaces the issue-005 placeholder.
create or replace function public.current_user_has_shop() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where owner_id = auth.uid())
$$;

alter table public.shops enable row level security;
revoke all on public.shops from anon, authenticated;
grant select on public.shops to anon, authenticated;
grant insert (owner_id, name, slug, description, suburb, state, postcode) on public.shops to authenticated;
grant update (name, slug, description, suburb, state, postcode, show_phone) on public.shops to authenticated;

create policy shops_select_public on public.shops for select to anon, authenticated using (status = 'approved');
create policy shops_select_owner on public.shops for select to authenticated using (owner_id = auth.uid());
create policy shops_select_admin on public.shops for select to authenticated using (public.is_admin());
create policy shops_insert_owner on public.shops for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user() and status = 'draft');
create policy shops_update_owner on public.shops for update to authenticated
  using (owner_id = auth.uid() and status <> 'suspended') with check (owner_id = auth.uid());
create policy shops_update_admin on public.shops for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
