-- Issue 044: the admin reports queue. Admins may read a conversation (and its messages) only once a
-- participant has reported it; otherwise threads stay private to the buyer and the shop owner.

create or replace function public.is_reported_conversation(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reports r where r.target_type = 'conversation' and r.target_id = p_conversation_id)
$$;
revoke execute on function public.is_reported_conversation(uuid) from public, anon;
grant execute on function public.is_reported_conversation(uuid) to authenticated;

create policy conversations_admin_read_reported on public.conversations for select to authenticated
  using (public.is_admin() and public.is_reported_conversation(id));
create policy messages_admin_read_reported on public.messages for select to authenticated
  using (public.is_admin() and public.is_reported_conversation(conversation_id));

-- Open reports grouped by target, oldest first (security invoker: RLS lets only admins see others' reports).
create or replace function public.admin_report_groups(p_page int default 1, p_page_size int default 24) returns jsonb
language sql stable set search_path = public as $$
  with groups as (
    select target_type, target_id, count(*)::int as count,
           array_agg(distinct reason::text) as reasons,
           coalesce(array_agg(note order by created_at) filter (where note is not null), '{}') as notes,
           min(created_at) as first_at, max(created_at) as latest_at,
           (array_agg(id order by created_at))[1] as report_id
      from reports where status = 'open'
     group by target_type, target_id
  )
  select jsonb_build_object(
    'total', (select count(*) from groups),
    'items', coalesce((select jsonb_agg(to_jsonb(g) order by g.first_at)
                         from (select * from groups order by first_at
                                offset (greatest(p_page, 1) - 1) * p_page_size limit p_page_size) g), '[]'::jsonb))
$$;
revoke execute on function public.admin_report_groups(int, int) from public, anon;
grant execute on function public.admin_report_groups(int, int) to authenticated;

-- Close every open report on the same target as p_report_id (dismissed or actioned), one audit row each.
-- Dismissing never restores a hidden listing: the admin clears reports_threshold explicitly.
create or replace function public.admin_decide_report(p_report_id uuid, p_status public.report_status, p_reason text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.reports;
  closed record;
  n int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_status not in ('dismissed', 'actioned') then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into r from reports where id = p_report_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if r.status <> 'open' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  for closed in
    update reports
       set status = p_status, resolved_by = auth.uid(), resolution_note = btrim(p_reason), resolved_at = now()
     where target_type = r.target_type and target_id = r.target_id and status = 'open'
    returning id
  loop
    perform log_admin_action(case when p_status = 'dismissed' then 'report.dismiss' else 'report.action' end,
      'report', closed.id::text, btrim(p_reason), jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.admin_decide_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.admin_decide_report(uuid, public.report_status, text) to authenticated;
