import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { listQueue, type ListingQueueItem } from '@/services/moderation.service'
import { completeDraft, ownerWithShop, uniqueVin } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const admin = async () => asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))

describe('listing review queues', () => {
  it("duplicate-vins: B's held listing is paired with A's live one (A's photo is public)", async () => {
    const vin = uniqueVin()
    const a = await ownerWithShop('a@x.ng', { cap: 50 })
    await adminDb().from('shops').update({ name: 'First Motors' }).eq('id', a.shopId)
    const aId = await completeDraft(a.db, a.shopId, { vin })
    await submitListing(a.db, aId, 1)
    const { data: aPhoto } = await adminDb().from('listing_images').select('id').eq('listing_id', aId).eq('position', 0).single()
    await adminDb().from('listing_images')
      .update({ public_paths: { sm: `${aId}/${aPhoto!.id}-sm.webp`, md: `${aId}/${aPhoto!.id}-md.webp`, lg: `${aId}/${aPhoto!.id}-lg.webp` } })
      .eq('id', aPhoto!.id)

    const b = await ownerWithShop('b@x.ng', { cap: 50 })
    const bId = await completeDraft(b.db, b.shopId, { vin })
    await submitListing(b.db, bId, 1)

    const staff = await admin()
    const res = await listQueue(staff, 'duplicate-vins', 1)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page.total).toBe(1)
    const item = res.value.items[0] as ListingQueueItem
    expect(item).toMatchObject({ id: bId, vin, status: 'in_review', title: '2019 Toyota HiLux', shop: { name: 'Coastal Cars' } })
    expect(item.submitted_at).toBeTruthy()
    expect(item.others).toHaveLength(1)
    expect(item.others[0]).toMatchObject({ id: aId, status: 'live', shop: { name: 'First Motors' } })
    expect(item.others[0].live_at).toBeTruthy()
    expect(item.others[0].photo_url).toContain('/object/public/listing-public/')

    expect(await listQueue(staff, 'duplicate-vins', 1, { countOnly: true }))
      .toMatchObject({ ok: true, value: { items: [], page: { total: 1 } } })
  })

  it("other-make-model: shows the typed make and model", async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng', { cap: 50 })
    const id = await completeDraft(db, shopId, { other: true })
    await submitListing(db, id, 1)
    const res = await listQueue(await admin(), 'other-make-model', 1)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.items[0]).toMatchObject({ id, make_other: 'Holden-ish', model_other: 'Special', title: '2019 Holden-ish Special' })
  })
})
