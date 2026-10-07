import { afterEach, describe, expect, it } from 'vitest'
import { processNextJobs } from '@/server/jobs/image-verification/pipeline'
import { listQueue, type ImageQueueItem } from '@/services/moderation.service'
import { draft, providers, seller, uploadFixture } from '../helpers/image-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function adminClient() {
  return asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
}

describe("listQueue(db, 'images')", () => {
  it('lists in_review photos with a signed quarantine URL and the evidence; passed photos are not in it', async () => {
    const { db } = await seller('a@x.ng')
    const listingId = await draft(db)
    const borderline = await uploadFixture(db, listingId, 'borderline-ai.jpg')
    await uploadFixture(db, listingId, 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)

    const res = await listQueue(await adminClient(), 'images', 1)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page.total).toBe(1)
    const item = res.value.items[0] as ImageQueueItem
    expect(item).toMatchObject({
      id: borderline, listing: { id: listingId, status: 'draft' }, shop: { name: 'Coastal Cars' },
      ai_check: { score: 0.7 }, car_check: { is_car: true }, phash_match: null,
      thresholds: { aiReviewThreshold: 0.5, aiRejectThreshold: 0.9 },
    })
    expect(item.signed_url).toContain('/storage/v1/object/sign/listing-quarantine/')
    expect(item.signed_url).toContain('token=')
    expect(item.decision_reason).toBeTruthy()
  })

  it('a reused photo from another shop carries the matched photo and shop', async () => {
    const a = await seller('a@x.ng')
    await uploadFixture(a.db, await draft(a.db), 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)
    await adminDb().from('shops').update({ name: 'First Motors' }).eq('id', a.shopId)
    const b = await seller('b@x.ng')
    const reused = await uploadFixture(b.db, await draft(b.db), 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)

    const res = await listQueue(await adminClient(), 'images', 1)
    if (!res.ok) throw new Error(res.error.message)
    const item = res.value.items.find((i) => (i as ImageQueueItem).id === reused) as ImageQueueItem
    expect(item.phash_match).toMatchObject({ distance: 0, matched_shop_name: 'First Motors' })
    expect(item.phash_match?.matched_signed_url).toContain('token=')
  })

  it('non-admins → FORBIDDEN', async () => {
    const { db } = await seller('a@x.ng')
    expect(await listQueue(db, 'images', 1)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
