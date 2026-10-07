import { afterEach, describe, expect, it } from 'vitest'
import { sendMessage, startConversation } from '@/services/messaging.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

async function thread() {
  const { db: owner, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const ownerId = (await owner.auth.getUser()).data.user?.id ?? ''
  const id = await completeDraft(owner, shopId)
  await submitListing(owner, id, 1)
  const buyerUser = await createUser({ email: 'jo@x.ng', displayName: 'Jo' })
  const buyer = await asUser(buyerUser)
  const started = await startConversation(buyer, id, 'Is it available?')
  if (!started.ok) throw new Error(started.error.message)
  return { owner, ownerId, buyer, buyerId: buyerUser.id, cid: started.value.conversation_id }
}

async function newMessageAlerts(userId: string) {
  const { data } = await adminDb().from('notifications').select('id,payload,created_at')
    .eq('user_id', userId).eq('kind', 'new_message').order('created_at')
  return data ?? []
}

describe('new_message alerts', () => {
  it('3 quick messages → one alert for the owner; 16 min later the next one queues another', async () => {
    const { buyer, ownerId, cid } = await thread()
    await sendMessage(buyer, cid, 'Second message')
    await sendMessage(buyer, cid, 'Third message')
    const first = await newMessageAlerts(ownerId)
    expect(first).toHaveLength(1)
    expect(first[0].payload).toMatchObject({
      senderName: 'Jo', title: '2019 Toyota HiLux', preview: 'Is it available?', path: `/sell/messages/${cid}`, recipientRole: 'seller',
    })

    await adminDb().from('notifications').update({ created_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq('id', first[0].id)
    await sendMessage(buyer, cid, 'Fourth message')
    expect(await newMessageAlerts(ownerId)).toHaveLength(2)
  })

  it('a seller reply alerts the buyer with a link to their inbox', async () => {
    const { owner, buyerId, cid } = await thread()
    await sendMessage(owner, cid, 'Yes, come by Saturday')
    const alerts = await newMessageAlerts(buyerId)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].payload).toMatchObject({ senderName: 'Coastal Cars', path: `/account/messages/${cid}`, recipientRole: 'buyer' })
  })

  it('the 61st message in an hour → RATE_LIMITED', async () => {
    const { buyer, buyerId, cid } = await thread()
    const rows = Array.from({ length: 59 }, (_, i) => ({ conversation_id: cid, sender_id: buyerId, body: `m${i}` }))
    await adminDb().from('messages').insert(rows)
    expect(await sendMessage(buyer, cid, 'the 61st')).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
  })

  it('a blocked conversation never queues alerts', async () => {
    const { buyer, ownerId, cid } = await thread()
    await adminDb().from('notifications').delete().eq('user_id', ownerId)
    await adminDb().from('conversations').update({ blocked_by: ownerId }).eq('id', cid)
    expect(await sendMessage(buyer, cid, 'hello?')).toMatchObject({ ok: false, error: { code: 'CONVERSATION_BLOCKED' } })
    expect(await newMessageAlerts(ownerId)).toHaveLength(0)
  })
})
