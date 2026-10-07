-- Issue 038: either participant can block a thread (docs/api-contracts.md → POST
-- /api/conversations/:id/block). send_message already refuses every send in a blocked thread
-- (both sides, so the blocker can't harass one-sidedly), and start_conversation reuses the
-- existing thread through send_message, so a blocked buyer can't restart it on the same listing.
-- The first block stands; unblocking is admin-only via SQL in v1.
create or replace function public.block_conversation(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if not is_conversation_participant(p_conversation_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  update conversations set blocked_by = auth.uid() where id = p_conversation_id and blocked_by is null;
end $$;
revoke execute on function public.block_conversation(uuid) from public, anon;
grant execute on function public.block_conversation(uuid) to authenticated;
