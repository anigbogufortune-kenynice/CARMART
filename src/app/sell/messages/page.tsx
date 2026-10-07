import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConversationList } from '@/components/messaging/ConversationList'
import { createServerSupabase } from '@/lib/supabase/server'
import { listConversations } from '@/services/messaging.service'
import { getMyShop } from '@/services/shop.service'

export const metadata: Metadata = { title: 'Buyer messages | CarMart', robots: { index: false } }
export const dynamic = 'force-dynamic'

/** /sell/messages: the seller inbox — every buyer conversation about the owner's cars. */
export default async function SellerMessagesPage() {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect('/sign-in?next=/sell/messages')
  const [shop, res] = await Promise.all([getMyShop(db), listConversations(db, 1, 'seller')])
  return (
    <main className="min-h-[60vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#14284B]">Buyer messages</h1>
        {!shop.ok ? (
          <div className="mt-6 rounded-xl border border-[#E2E7EF] bg-white px-5 py-6">
            <p className="text-[#1B2333]">You don’t have a shop yet. Create one to sell cars and get messages from buyers.</p>
            <Link href="/sell" className="mt-4 inline-block rounded-md bg-[#14284B] px-4 py-2 font-medium text-white hover:bg-[#0E1D38]">Create your shop</Link>
          </div>
        ) : res.ok ? (
          <ConversationList items={res.value.items} basePath="/sell/messages" empty="No buyer messages yet. They’ll appear here when buyers ask about your cars." />
        ) : (
          <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load your messages. Please try again.</p>
        )}
      </div>
    </main>
  )
}
