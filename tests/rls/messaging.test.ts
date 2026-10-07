import { afterEach, describe, expect, it } from 'vitest'
import { startConversation } from '@/services/messaging.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

describe('conversations / messages RLS', () => {
  it('only the buyer and the shop owner can read a thread; others can’t read or write', async () => {
    const { db: owner, shopId } = await ownerWithShop('owner@x.ng')
    const listing = await completeDraft(owner, shopId)
    await submitListing(owner, listing, 1)
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng' }))
    const started = await startConversation(buyer, listing, 'Is it still available?')
    if (!started.ok) throw new Error(started.error.message)
    const id = started.value.conversation_id

    for (const db of [buyer, owner]) {
      expect(((await db.from('conversations').select('id').eq('id', id)).data ?? [])).toHaveLength(1)
      expect(((await db.from('messages').select('id').eq('conversation_id', id)).data ?? [])).toHaveLength(1)
    }
    const stranger = await asUser(await createUser({ email: 'stranger@x.ng' }))
    for (const db of [stranger, anonDb()]) {
      expect(((await db.from('conversations').select('id').eq('id', id)).data ?? [])).toHaveLength(0)
      expect(((await db.from('messages').select('id').eq('conversation_id', id)).data ?? [])).toHaveLength(0)
    }
    const { data: me } = await stranger.auth.getUser()
    const sneak = await stranger.from('messages').insert({ conversation_id: id, sender_id: me.user!.id, body: 'hi' })
    expect(sneak.error).not.toBeNull()
  })
})
