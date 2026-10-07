-- Issue 043: reports (docs/schema.md → reports; docs/systems/listing-lifecycle.md → report_threshold,
-- EC-L10). Reports are created only through create_report.

create type public.report_target as enum ('listing', 'shop', 'conversation');
create type public.report_reason as enum ('scam', 'not_a_car', 'ai_or_fake_photos', 'wrong_details', 'offensive', 'other');
create type public.report_status as enum ('open', 'dismissed', 'actioned');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note text check (note is null or char_length(note) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reports_one_open_per_user on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_status_idx on public.reports (status, created_at);
create index reports_open_target_idx on public.reports (target_type, target_id) where status = 'open';
create index reports_reporter_created_idx on public.reports (reporter_id, created_at);
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant update (status, resolved_by, resolution_note, resolved_at) on public.reports to authenticated;
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());
create policy reports_select_admin on public.reports for select to authenticated using (public.is_admin());
create policy reports_update_admin on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Report something the caller can see. A live listing reaching reports_auto_hide_count open reports
-- from distinct users leaves search: in_review with reports_threshold. Sold listings never auto-hide.
create or replace function public.create_report(
  p_target_type public.report_target, p_target_id uuid, p_reason public.report_reason, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  visible boolean;
  l public.listings;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;

  visible := case p_target_type
    when 'listing' then exists (
      select 1 from listings x join shops s on s.id = x.shop_id
       where x.id = p_target_id and x.status in ('live', 'sold') and s.status = 'approved')
    when 'shop' then exists (select 1 from shops s where s.id = p_target_id and s.status = 'approved')
    when 'conversation' then is_conversation_participant(p_target_id)
  end;
  if not visible then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if exists (select 1 from reports where reporter_id = auth.uid() and target_type = p_target_type
              and target_id = p_target_id and status = 'open') then
    raise exception 'ALREADY_REPORTED' using errcode = 'P0001';
  end if;
  if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '24 hours')
     >= coalesce(setting_num('daily_report_limit'), 10) then
    raise exception 'REPORT_LIMIT' using errcode = 'P0001';
  end if;

  insert into reports (reporter_id, target_type, target_id, reason, note)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into new_id;

  if p_target_type = 'listing' then
    select * into l from listings where id = p_target_id for update;
    if l.status = 'live'
       and (select count(distinct reporter_id) from reports
             where target_type = 'listing' and target_id = l.id and status = 'open')
           >= coalesce(setting_num('reports_auto_hide_count'), 3) then
      update listings
         set status = 'in_review', version = version + 1,
             review_flags = case when 'reports_threshold' = any (review_flags) then review_flags
                                 else review_flags || 'reports_threshold'::review_flag end
       where id = l.id;
    end if;
  end if;
  return new_id;
end $$;
-- anon may call it only to get a clean UNAUTHENTICATED.
revoke execute on function public.create_report(public.report_target, uuid, public.report_reason, text) from public;
grant execute on function public.create_report(public.report_target, uuid, public.report_reason, text) to anon, authenticated;
