import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { startConversation } from '@/services/messaging.service'
import { createReport } from '@/services/report.service'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

describe('admins and conversations', () => {
  it('admins can’t read a conversation until a participant reports it', async () => {
    const { db: owner, shopId } = await ownerWithShop('owner@x.ng')
    const listing = await completeDraft(owner, shopId)
    await submitListing(owner, listing, 1)
    const buyer = await asUser(await createUser({ email: 'buyer@x.ng' }))
    const started = await startConversation(buyer, listing, 'Send me your bank details first')
    if (!started.ok) throw new Error(started.error.message)
    const id = started.value.conversation_id
    const admin = await asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))

    expect((await admin.from('messages').select('id').eq('conversation_id', id)).data ?? []).toHaveLength(0)
    expect((await admin.from('conversations').select('id').eq('id', id)).data ?? []).toHaveLength(0)

    expect(await createReport(owner, { target_type: 'conversation', target_id: id, reason: 'scam' })).toMatchObject({ ok: true })
    expect((await admin.from('messages').select('body').eq('conversation_id', id)).data).toEqual([{ body: 'Send me your bank details first' }])
    expect((await admin.from('conversations').select('id').eq('id', id)).data ?? []).toHaveLength(1)
  })
})
