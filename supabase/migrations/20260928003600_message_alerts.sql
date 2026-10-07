-- Issue 036: new-message email alerts (throttled by enqueue_notification: one per thread per
-- recipient every 15 minutes, docs/schema.md) and the 60-messages-an-hour limit (docs/auth.md).

insert into public.app_settings (key, value) values ('hourly_message_limit', '60')
  on conflict (key) do nothing;

create or replace function public.send_message(p_conversation_id uuid, p_body text) returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  m public.messages;
  sender_is_buyer boolean;
  recipient uuid;
  sender_name text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into c from conversations where id = p_conversation_id for update;
  if not found or not (c.buyer_id = auth.uid() or owns_shop(c.shop_id)) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if c.blocked_by is not null then raise exception 'CONVERSATION_BLOCKED' using errcode = 'P0001'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  if (select count(*) from messages x where x.sender_id = auth.uid() and x.created_at > now() - interval '1 hour')
     >= coalesce(setting_num('hourly_message_limit'), 60) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into messages (conversation_id, sender_id, body) values (c.id, auth.uid(), btrim(p_body)) returning * into m;
  update conversations set last_message_at = m.created_at where id = c.id;

  sender_is_buyer := c.buyer_id = auth.uid();
  if sender_is_buyer then
    select s.owner_id, coalesce(nullif(p.display_name, ''), 'A buyer') into recipient, sender_name
      from shops s, profiles p where s.id = c.shop_id and p.id = auth.uid();
  else
    select c.buyer_id, s.name into recipient, sender_name from shops s where s.id = c.shop_id;
  end if;
  perform enqueue_notification(recipient, 'new_message', c.id, jsonb_build_object(
    'senderName', sender_name,
    'title', listing_title(c.listing_id),
    'preview', left(m.body, 300),
    'path', case when sender_is_buyer then '/sell/messages/' else '/account/messages/' end || c.id,
    'recipientRole', case when sender_is_buyer then 'seller' else 'buyer' end,
    'conversationId', c.id));
  return m;
end $$;
revoke execute on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;
