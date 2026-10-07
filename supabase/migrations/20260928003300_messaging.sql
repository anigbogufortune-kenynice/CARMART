-- Issue 033: buyer ↔ seller messaging (docs/schema.md → conversations, messages; Q10).
-- Threads are created only through start_conversation (live listing, buyer ≠ owner, daily limit).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  blocked_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_listing_buyer_key unique (listing_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_shop_idx on public.conversations (shop_id, last_message_at desc);
create index conversations_buyer_created_idx on public.conversations (buyer_id, created_at);
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
     where c.id = p_conversation_id and (c.buyer_id = auth.uid() or owns_shop(c.shop_id))
  )
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;

create policy conversations_participants_read on public.conversations for select to authenticated
  using (buyer_id = auth.uid() or public.owns_shop(shop_id));
create policy messages_participants_read on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));

-- Sending: participants of an unblocked thread, active users only. Bumps last_message_at.
create or replace function public.send_message(p_conversation_id uuid, p_body text) returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  m public.messages;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into c from conversations where id = p_conversation_id for update;
  if not found or not (c.buyer_id = auth.uid() or owns_shop(c.shop_id)) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if c.blocked_by is not null then raise exception 'CONVERSATION_BLOCKED' using errcode = 'P0001'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  insert into messages (conversation_id, sender_id, body) values (c.id, auth.uid(), btrim(p_body)) returning * into m;
  update conversations set last_message_at = m.created_at where id = c.id;
  return m;
end $$;
revoke execute on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

-- Start (or reuse) the caller's thread about a live listing. Only a new thread counts toward the
-- daily_conversation_limit (20 per rolling 24 h).
create or replace function public.start_conversation(p_listing_id uuid, p_body text)
returns table (conversation_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  s public.shops;
  existing uuid;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR' using errcode = 'P0001'; end if;
  select * into l from listings where id = p_listing_id;
  if not found or l.status <> 'live' then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into s from shops where id = l.shop_id;
  if s.status <> 'approved' then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if s.owner_id = auth.uid() then raise exception 'OWN_LISTING' using errcode = 'P0001'; end if;
  if not is_active_user() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  select c.id into existing from conversations c where c.listing_id = l.id and c.buyer_id = auth.uid();
  if existing is not null then
    perform send_message(existing, p_body);
    return query select existing, false;
    return;
  end if;

  if (select count(*) from conversations c where c.buyer_id = auth.uid() and c.created_at > now() - interval '24 hours')
     >= coalesce(setting_num('daily_conversation_limit'), 20) then
    raise exception 'CONVERSATION_LIMIT' using errcode = 'P0001';
  end if;
  insert into conversations (listing_id, shop_id, buyer_id) values (l.id, s.id, auth.uid()) returning id into new_id;
  perform send_message(new_id, p_body);
  return query select new_id, true;
end $$;
revoke execute on function public.start_conversation(uuid, text) from public, anon;
grant execute on function public.start_conversation(uuid, text) to authenticated;

-- Mark the other party's messages in a thread as read.
create or replace function public.mark_conversation_read(p_conversation_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_conversation_participant(p_conversation_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  update messages set read_at = now()
   where conversation_id = p_conversation_id and sender_id <> auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- The caller's threads (as buyer or seller), newest activity first, with unread counts.
create or replace function public.my_conversations(p_page int default 1, p_page_size int default 24) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select c.*, case when c.buyer_id = auth.uid() then 'buyer' else 'seller' end as role
      from conversations c
     where c.buyer_id = auth.uid() or c.shop_id in (select id from shops where owner_id = auth.uid())
  ),
  rows as (
    select m.id, m.listing_id, m.role, m.last_message_at, m.blocked_by is not null as blocked,
           coalesce(nullif(concat_ws(' ', l.year::text, coalesce(l.make_other, mk.name), coalesce(l.model_other, md.name)), ''), 'Untitled car') as listing_title,
           case when m.role = 'buyer' then s.name else p.display_name end as other_party,
           (select count(*) from messages x where x.conversation_id = m.id and x.sender_id <> auth.uid() and x.read_at is null) as unread_count,
           (select jsonb_build_object('body', left(x.body, 140), 'created_at', x.created_at, 'mine', x.sender_id = auth.uid())
              from messages x where x.conversation_id = m.id order by x.created_at desc limit 1) as last_message
      from mine m
      join listings l on l.id = m.listing_id
      join shops s on s.id = m.shop_id
      join profiles p on p.id = m.buyer_id
      left join vehicle_makes mk on mk.id = l.make_id
      left join vehicle_models md on md.id = l.model_id
  )
  select jsonb_build_object(
    'total', (select count(*) from rows),
    'items', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.last_message_at desc)
        from (select * from rows order by last_message_at desc
               offset (greatest(p_page, 1) - 1) * p_page_size limit p_page_size) r
    ), '[]'::jsonb))
$$;
revoke execute on function public.my_conversations(int, int) from public, anon;
grant execute on function public.my_conversations(int, int) to authenticated;
