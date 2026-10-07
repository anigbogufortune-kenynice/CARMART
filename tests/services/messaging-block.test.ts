import { afterEach, describe, expect, it } from 'vitest'
import { blockConversation, listMessages, sendMessage, startConversation } from '@/services/messaging.service'
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
  const buyer = await asUser(await createUser({ email: 'jo@x.ng' }))
  const started = await startConversation(buyer, id, 'hello')
  if (!started.ok) throw new Error(started.error.message)
  return { owner, ownerId, buyer, listingId: id, cid: started.value.conversation_id }
}

describe('blockConversation', () => {
  it('the owner blocks → blocked_by = owner; a third user → NOT_FOUND', async () => {
    const { owner, ownerId, cid } = await thread()
    const stranger = await asUser(await createUser({ email: 'stranger@x.ng' }))
    expect(await blockConversation(stranger, cid)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await blockConversation(owner, cid)).toEqual({ ok: true, value: null })
    const { data } = await adminDb().from('conversations').select('blocked_by').eq('id', cid).single()
    expect(data?.blocked_by).toBe(ownerId)
  })

  it('after a block nobody can send, the blocked buyer can’t restart it, and both can still read', async () => {
    const { owner, buyer, listingId, cid } = await thread()
    await blockConversation(owner, cid)
    expect(await sendMessage(buyer, cid, 'hi?')).toMatchObject({ ok: false, error: { code: 'CONVERSATION_BLOCKED' } })
    expect(await sendMessage(owner, cid, 'bye')).toMatchObject({ ok: false, error: { code: 'CONVERSATION_BLOCKED' } })
    expect(await startConversation(buyer, listingId, 'again')).toMatchObject({ ok: false, error: { code: 'CONVERSATION_BLOCKED' } })
    expect(await listMessages(owner, cid, {})).toMatchObject({ ok: true, value: [{ body: 'hello' }] })
    expect(await listMessages(buyer, cid, {})).toMatchObject({ ok: true, value: [{ body: 'hello' }] })
  })

  it('blocking twice keeps the first blocker', async () => {
    const { owner, ownerId, buyer, cid } = await thread()
    await blockConversation(owner, cid)
    expect(await blockConversation(buyer, cid)).toEqual({ ok: true, value: null })
    const { data } = await adminDb().from('conversations').select('blocked_by').eq('id', cid).single()
    expect(data?.blocked_by).toBe(ownerId)
  })
})
