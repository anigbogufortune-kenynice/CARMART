-- Issue 006: safe concurrent dispatch. Rows are claimed (status 'sending') with
-- FOR UPDATE SKIP LOCKED so two dispatchers never send the same email.
alter table public.notifications drop constraint notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));
alter table public.notifications add column locked_at timestamptz;

create or replace function public.claim_notifications(p_limit int)
returns setof public.notifications
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.notifications n
     set status = 'sending', locked_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.notifications
      where status = 'pending'
         or (status = 'sending' and locked_at < now() - interval '5 minutes') -- crashed dispatcher
      order by created_at
      for update skip locked
      limit greatest(1, least(p_limit, 200))
   )
  returning n.*;
end $$;

create or replace function public.finish_notification(p_id uuid, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('pending', 'sent', 'failed', 'skipped') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.notifications
     set status = p_status,
         locked_at = null,
         last_error = p_error,
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_id and status = 'sending';
end $$;

revoke execute on function public.claim_notifications(int) from public, anon, authenticated;
revoke execute on function public.finish_notification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.finish_notification(uuid, text, text) to service_role;
