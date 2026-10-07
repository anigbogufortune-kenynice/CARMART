import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConversationList } from '@/components/messaging/ConversationList'
import { createServerSupabase } from '@/lib/supabase/server'
import { listConversations } from '@/services/messaging.service'

export const metadata: Metadata = { title: 'Messages | CarMart', robots: { index: false } }
export const dynamic = 'force-dynamic'

/** /account/messages: the buyer inbox (threads the caller started about other shops' cars). */
export default async function MessagesPage() {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect('/sign-in?next=/account/messages')
  const res = await listConversations(db, 1, 'buyer')
  return (
    <main className="min-h-[60vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#14284B]">Messages</h1>
        {res.ok
          ? <ConversationList items={res.value.items} basePath="/account/messages" empty="No messages yet. Find a car you like and message the seller." />
          : <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load your messages. Please try again.</p>}
      </div>
    </main>
  )
}
