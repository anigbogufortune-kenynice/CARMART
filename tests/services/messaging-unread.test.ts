import { afterEach, describe, expect, it } from 'vitest'
import { listMessages, sendMessage, startConversation, unreadCount } from '@/services/messaging.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

describe('unreadCount', () => {
  it('3 buyer messages → the owner has 3 seller-side unread; opening the thread → 0', async () => {
    const { db: owner, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
    const id = await completeDraft(owner, shopId)
    await submitListing(owner, id, 1)
    const buyer = await asUser(await createUser({ email: 'jo@x.ng', displayName: 'Jo' }))
    const started = await startConversation(buyer, id, 'one')
    if (!started.ok) throw new Error(started.error.message)
    const cid = started.value.conversation_id
    await sendMessage(buyer, cid, 'two')
    await sendMessage(buyer, cid, 'three')

    expect(await unreadCount(owner)).toEqual({ ok: true, value: { total: 3, buyer: 0, seller: 3 } })
    expect(await unreadCount(buyer)).toEqual({ ok: true, value: { total: 0, buyer: 0, seller: 0 } })

    await listMessages(owner, cid, {})
    expect(await unreadCount(owner)).toEqual({ ok: true, value: { total: 0, buyer: 0, seller: 0 } })

    await sendMessage(owner, cid, 'Yes, still available')
    expect(await unreadCount(buyer)).toEqual({ ok: true, value: { total: 1, buyer: 1, seller: 0 } })
  })
})
