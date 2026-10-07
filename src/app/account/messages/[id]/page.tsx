import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ThreadView } from '@/components/messaging/ThreadView'
import { createServerSupabase } from '@/lib/supabase/server'
import { isUuid } from '@/lib/uuid'
import { getConversation, listMessages } from '@/services/messaging.service'

export const metadata: Metadata = { title: 'Conversation | CarMart', robots: { index: false } }
export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

/** /account/messages/[id]: one buyer thread. Non-participants get a 404. */
export default async function ConversationPage({ params }: Props) {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect(`/sign-in?next=${encodeURIComponent(`/account/messages/${params.id}`)}`)
  if (!isUuid(params.id)) notFound()
  const conversation = await getConversation(db, params.id)
  if (!conversation.ok) notFound()
  const messages = await listMessages(db, params.id, {})
  const c = conversation.value
  return (
    <main className="min-h-[60vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/account/messages" className="text-sm text-[#14284B] underline">← All messages</Link>
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
