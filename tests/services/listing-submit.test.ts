import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { createDraft } from '@/services/listing.service'
import { adminDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop, uniqueVin } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

describe('submit guards', () => {
  it('SHOP_NOT_APPROVED for a draft shop', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au', { approved: false })
    const id = await completeDraft(db, shopId)
    expect(await submitListing(db, id, 1)).toMatchObject({ ok: false, error: { code: 'SHOP_NOT_APPROVED' } })
  })

  it('LISTING_INCOMPLETE names the missing fields', async () => {
    const { db } = await ownerWithShop('a@x.au')
    const d = await createDraft(db, { year: 2019 })
    if (!d.ok) throw new Error('draft')
    const res = await submitListing(db, d.value.id, 1)
    expect(res).toMatchObject({ ok: false, error: { code: 'LISTING_INCOMPLETE' } })
    if (res.ok) return
    expect(res.error.message).toContain('vin')
    expect(res.error.message).not.toContain('year')
  })

  it('PHOTO_COUNT with 3 photos; unconfirmed uploads don’t count', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    expect(await submitListing(db, await completeDraft(db, shopId, { photos: 3 }), 1)).toMatchObject({ ok: false, error: { code: 'PHOTO_COUNT' } })
    const id = await completeDraft(db, shopId, { photos: 3 })
    await adminDb().from('listing_images').insert({
      listing_id: id, shop_id: shopId, position: 9, quarantine_path: `${shopId}/${id}/pending`, mime_type: 'image/jpeg', bytes: 1, status: 'uploaded',
    })
    expect(await submitListing(db, id, 1)).toMatchObject({ ok: false, error: { code: 'PHOTO_COUNT' } })
  })

  it('LISTING_LIMIT_REACHED at the cap; VERSION_CONFLICT on a stale version; INVALID_STATE when live', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au', { cap: 1 })
    const first = await completeDraft(db, shopId)
    expect(await submitListing(db, first, 1)).toMatchObject({ ok: true, value: { status: 'live' } })
    expect(await submitListing(db, await completeDraft(db, shopId), 1)).toMatchObject({ ok: false, error: { code: 'LISTING_LIMIT_REACHED' } })
    expect(await submitListing(db, first, 3)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
    const other = await ownerWithShop('b@x.au')
    expect(await submitListing(other.db, await completeDraft(other.db, other.shopId), 7)).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } })
  })

  it('NOT_FOUND for someone else’s listing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId)
    const other = await ownerWithShop('b@x.au')
    expect(await submitListing(other.db, id, 1)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('VIN and Other flags', () => {
  it('DUPLICATE_LISTING when the same shop already has the VIN active', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const vin = uniqueVin()
    await submitListing(db, await completeDraft(db, shopId, { vin }), 1)
    expect(await submitListing(db, await completeDraft(db, shopId, { vin }), 1)).toMatchObject({ ok: false, error: { code: 'DUPLICATE_LISTING' } })
  })

  it('another shop’s live VIN → in_review with duplicate_vin', async () => {
    const vin = uniqueVin()
    const a = await ownerWithShop('a@x.au')
    expect(await submitListing(a.db, await completeDraft(a.db, a.shopId, { vin }), 1)).toMatchObject({ ok: true, value: { status: 'live' } })
    const b = await ownerWithShop('b@x.au')
    const res = await submitListing(b.db, await completeDraft(b.db, b.shopId, { vin }), 1)
    expect(res).toMatchObject({ ok: true, value: { status: 'in_review', review_flags: ['duplicate_vin'] } })
  })

  it('an “Other” make → in_review with other_make_model', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const res = await submitListing(db, await completeDraft(db, shopId, { other: true }), 1)
    expect(res).toMatchObject({ ok: true, value: { status: 'in_review', review_flags: ['other_make_model'] } })
  })
})

describe('cap race (EC-L11)', () => {
  it('two parallel submits for the last slot: exactly one succeeds', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au', { cap: 1 })
    const [x, y] = [await completeDraft(db, shopId), await completeDraft(db, shopId)]
    const results = await Promise.all([submitListing(db, x, 1), submitListing(db, y, 1)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.find((r) => !r.ok)).toMatchObject({ error: { code: 'LISTING_LIMIT_REACHED' } })
  })
})
