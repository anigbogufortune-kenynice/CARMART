import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { isUuid } from '@/lib/uuid'
import { getConversation, listMessages, type ConversationRole } from '@/services/messaging.service'
import { ThreadView } from './ThreadView'

const INBOX: Record<ConversationRole, { path: string; label: string }> = {
  buyer: { path: '/account/messages', label: '← All messages' },
  seller: { path: '/sell/messages', label: '← Buyer messages' },
}

/**
 * One thread page (server). Shared by /account/messages/[id] (buyer side) and /sell/messages/[id]
 * (seller side); a thread opened from the wrong inbox redirects to the right one. Opening marks the
 * other party's messages read.
 */
export async function ConversationScreen({ id, side }: { id: string; side: ConversationRole }) {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect(`/sign-in?next=${encodeURIComponent(`${INBOX[side].path}/${id}`)}`)
  if (!isUuid(id)) notFound()
  const conversation = await getConversation(db, id)
  if (!conversation.ok) notFound()
  const c = conversation.value
  if (c.role !== side) redirect(`${INBOX[c.role].path}/${id}`)
  const messages = await listMessages(db, id, {})
  return (
    <main className="min-h-[60vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href={INBOX[side].path} className="text-sm text-[#14284B] underline">{INBOX[side].label}</Link>
        <h1 className="mt-3 text-2xl font-semibold text-[#14284B]">{c.other_party}</h1>
        <p className="mb-4 text-sm text-[#5A6578]">
          About <Link href={`/cars/${c.listing_id}`} className="underline">{c.listing_title}</Link>
          {c.listing_status === 'sold' ? ' · Sold' : ''}
        </p>
        {messages.ok
          ? <ThreadView conversationId={c.id} currentUserId={auth.user.id} initial={messages.value} blocked={c.blocked} />
          : <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load this conversation. Please try again.</p>}
      </div>
    </main>
  )
}
