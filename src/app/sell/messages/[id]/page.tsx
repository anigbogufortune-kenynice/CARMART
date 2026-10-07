import type { Metadata } from 'next'
import { ConversationScreen } from '@/components/messaging/ConversationScreen'

export const metadata: Metadata = { title: 'Conversation | CarMart', robots: { index: false } }
export const dynamic = 'force-dynamic'

/** /sell/messages/[id]: one thread, seller side. */
export default function ConversationPage({ params }: { params: { id: string } }) {
  return <ConversationScreen id={params.id} side="seller" />
}
