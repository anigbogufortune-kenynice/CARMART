import { afterEach, describe, expect, it } from 'vitest'
import { listConversations, listMessages, sendMessage, startConversation } from '@/services/messaging.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

async function liveListing(email = 'owner@x.ng') {
  const { db, shopId } = await ownerWithShop(email, { cap: 50 })
  const id = await completeDraft(db, shopId)
  await submitListing(db, id, 1)
  return { owner: db, shopId, id }
}

describe('startConversation', () => {
  it('draft → NOT_FOUND; the owner → OWN_LISTING; then created, then the same thread', async () => {
    const { owner, shopId, id } = await liveListing()
    const draft = await completeDraft(owner, shopId)
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng' }))
    expect(await startConversation(buyer, draft, 'hi')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await startConversation(owner, id, 'hi')).toMatchObject({ ok: false, error: { code: 'OWN_LISTING' } })

    const first = await startConversation(buyer, id, 'Is it available?')
    expect(first).toMatchObject({ ok: true, value: { created: true } })
    const second = await startConversation(buyer, id, 'Can I see it Saturday?')
    expect(second).toMatchObject({ ok: true, value: { created: false } })
    if (!first.ok || !second.ok) return
    expect(second.value.conversation_id).toBe(first.value.conversation_id)
    const msgs = (await adminDb().from('messages').select('id').eq('conversation_id', first.value.conversation_id)).data ?? []
    expect(msgs).toHaveLength(2)
  })

  it('a 21st new thread in 24 h → CONVERSATION_LIMIT; messages in existing threads still go', async () => {
    const { owner, shopId, id } = await liveListing()
    const ids = [id]
    for (let i = 0; i < 20; i++) {
      const extra = await completeDraft(owner, shopId)
      await submitListing(owner, extra, 1)
      ids.push(extra)
    }
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng' }))
    for (const l of ids.slice(0, 20)) expect((await startConversation(buyer, l, 'hi')).ok).toBe(true)
    expect(await startConversation(buyer, ids[20], 'hi')).toMatchObject({ ok: false, error: { code: 'CONVERSATION_LIMIT' } })
    expect((await startConversation(buyer, ids[0], 'still there?')).ok).toBe(true)
  }, 120_000)
})

describe('sendMessage', () => {
  it('text only, 1–2000 characters', async () => {
    const { id } = await liveListing()
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng' }))
    const started = await startConversation(buyer, id, 'hello')
    if (!started.ok) throw new Error('start')
    const cid = started.value.conversation_id
    expect(await sendMessage(buyer, cid, '   ')).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await sendMessage(buyer, cid, 'x'.repeat(2001))).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await sendMessage(buyer, cid, 'Price negotiable?')).toMatchObject({ ok: true, value: { body: 'Price negotiable?' } })
  })
})

describe('listConversations / listMessages', () => {
  it('the owner sees 2 unread; reading the thread marks them read', async () => {
    const { owner, id } = await liveListing()
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng', displayName: 'Ada' }))
    const started = await startConversation(buyer, id, 'first')
    if (!started.ok) throw new Error('start')
    await sendMessage(buyer, started.value.conversation_id, 'second')

    const before = await listConversations(owner, 1)
    if (!before.ok) throw new Error(before.error.message)
    expect(before.value.items[0]).toMatchObject({
      id: started.value.conversation_id, listing_title: '2019 Toyota HiLux', other_party: 'Ada', unread_count: 2,
      last_message: { body: 'second' }, role: 'seller',
    })

    const msgs = await listMessages(owner, started.value.conversation_id, {})
    if (!msgs.ok) throw new Error(msgs.error.message)
    expect(msgs.value.map((m) => m.body)).toEqual(['first', 'second'])
    const after = await listConversations(owner, 1)
    expect(after.ok && after.value.items[0].unread_count).toBe(0)

    const buyerView = await listConversations(buyer, 1)
    expect(buyerView.ok && buyerView.value.items[0]).toMatchObject({ role: 'buyer', other_party: 'Coastal Cars', unread_count: 0 })
  })
})
