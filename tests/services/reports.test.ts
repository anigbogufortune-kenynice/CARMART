import { afterEach, describe, expect, it } from 'vitest'
import { markSold, submitListing } from '@/services/listing-lifecycle.service'
import { startConversation } from '@/services/messaging.service'
import { createReport } from '@/services/report.service'
import { searchListings } from '@/services/search.service'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function live() {
  const { db, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const id = await completeDraft(db, shopId)
  await submitListing(db, id, 1)
  return { owner: db, shopId, id }
}
const user = async (n: string) => asUser(await createUser({ email: `${n}@x.ng` }))
const listing = async (id: string) => (await adminDb().from('listings').select('status,review_flags,version').eq('id', id).single()).data!

describe('createReport', () => {
  it('draft → NOT_FOUND; twice → ALREADY_REPORTED; 11th in a day → REPORT_LIMIT; non-participant conversation → NOT_FOUND', async () => {
    const { owner, shopId, id } = await live()
    const draft = await completeDraft(owner, shopId)
    const jo = await user('jo')
    expect(await createReport(jo, { target_type: 'listing', target_id: draft, reason: 'scam' })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await createReport(jo, { target_type: 'listing', target_id: id, reason: 'scam' })).toMatchObject({ ok: true })
    expect(await createReport(jo, { target_type: 'listing', target_id: id, reason: 'other', note: 'again' })).toMatchObject({ ok: false, error: { code: 'ALREADY_REPORTED' } })
    expect(await createReport(jo, { target_type: 'shop', target_id: shopId, reason: 'scam' })).toMatchObject({ ok: true })

    const { data: me } = await jo.auth.getUser()
    const fillers = Array.from({ length: 8 }, () => ({ reporter_id: me.user!.id, target_type: 'shop', target_id: crypto.randomUUID(), reason: 'other' }))
    await adminDb().from('reports').insert(fillers)
    const extra = await completeDraft(owner, shopId)
    await submitListing(owner, extra, 1)
    expect(await createReport(jo, { target_type: 'listing', target_id: extra, reason: 'scam' })).toMatchObject({ ok: false, error: { code: 'REPORT_LIMIT' } })

    const buyer = await user('buyer')
    const started = await startConversation(buyer, id, 'hello')
    if (!started.ok) throw new Error(started.error.message)
    const stranger = await user('stranger')
    expect(await createReport(stranger, { target_type: 'conversation', target_id: started.value.conversation_id, reason: 'offensive' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await createReport(owner, { target_type: 'conversation', target_id: started.value.conversation_id, reason: 'offensive' }))
      .toMatchObject({ ok: true })
    expect(await createReport(anonDb(), { target_type: 'listing', target_id: id, reason: 'scam' })).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
  })

  it('3 distinct reporters hide a live listing (in_review + reports_threshold, out of search)', async () => {
    const { id } = await live()
    for (const n of ['a', 'b']) await createReport(await user(n), { target_type: 'listing', target_id: id, reason: 'scam' })
    expect(await listing(id)).toMatchObject({ status: 'live' })
    await createReport(await user('c'), { target_type: 'listing', target_id: id, reason: 'ai_or_fake_photos' })
    const after = await listing(id)
    expect(after.status).toBe('in_review')
    expect(after.review_flags).toContain('reports_threshold')
    const found = await searchListings(anonDb(), { sort: 'newest', page: 1 })
    expect(found.ok && found.value.items.map((c) => c.id)).not.toContain(id)
  })

  it('a sold listing can be reported but is never auto-hidden', async () => {
    const { owner, id } = await live()
    const sold = await markSold(owner, id, (await listing(id)).version)
    if (!sold.ok) throw new Error(sold.error.message)
    for (const n of ['a', 'b', 'c']) {
      expect(await createReport(await user(n), { target_type: 'listing', target_id: id, reason: 'scam' })).toMatchObject({ ok: true })
    }
    expect(await listing(id)).toMatchObject({ status: 'sold' })
  })
})
