import { afterEach, describe, expect, it } from 'vitest'
import { getListingForViewer } from '@/services/search.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

async function liveListing(email = 'seller@x.ng') {
  const { db, shopId } = await ownerWithShop(email)
  const id = await completeDraft(db, shopId)
  await adminDb().from('listing_images').update({ public_paths: { sm: 'p/sm.webp', md: 'p/md.webp', lg: 'p/lg.webp' } }).eq('listing_id', id)
  const r = await submitListing(db, id, 1)
  if (!r.ok || r.value.status !== 'live') throw new Error('listing did not go live')
  return { db, shopId, id }
}

describe('getListingForViewer: public', () => {
  it('anon sees a live listing of an approved shop with ordered passed photos and no owner fields', async () => {
    const { id } = await liveListing()
    const res = await getListingForViewer(anonDb(), id)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const v = res.value
    expect(v.view).toBe('public')
    expect(v.title).toBe('2019 Toyota HiLux')
    expect(v.photos).toHaveLength(4)
    expect(v.photos.map((p) => p.position)).toEqual([0, 1, 2, 3])
    expect(v.photos[0].urls?.md).toMatch(/listing-public\/p\/md\.webp$/)
    expect(v.shop).toMatchObject({ name: 'Coastal Cars', state: 'Lagos' })
    expect(v).not.toHaveProperty('review_flags')
    expect(v).not.toHaveProperty('rego')
    expect(v.photos[0]).not.toHaveProperty('status')
  })

  it('anon on a checking listing → NOT_FOUND; live listing of a suspended shop → NOT_FOUND', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const checking = await completeDraft(db, shopId, { photoStatus: 'checking' })
    await submitListing(db, checking, 1)
    expect(await getListingForViewer(anonDb(), checking)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })

    const { id, shopId: liveShop } = await liveListing('b@x.ng')
    await adminDb().from('shops').update({ status: 'suspended' }).eq('id', liveShop)
    expect(await getListingForViewer(anonDb(), id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('getListingForViewer: owner and admin', () => {
  it('owner sees a rejected listing with every photo, statuses and reasons', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId)
    const first = (await adminDb().from('listing_images').select('id').eq('listing_id', id).order('position').limit(1)).data![0]
    await adminDb().from('listing_images').update({ status: 'rejected', status_reason: 'This doesn’t look like a car' }).eq('id', first.id)
    await submitListing(db, id, 1)
    const res = await getListingForViewer(db, id)
    expect(res.ok).toBe(true)
    if (!res.ok || res.value.view !== 'owner') throw new Error('expected owner view')
    expect(res.value.status).toBe('rejected')
    expect(res.value.photos).toHaveLength(4)
    expect(res.value.photos[0]).toMatchObject({ status: 'rejected', status_reason: 'This doesn’t look like a car' })
    expect(res.value.status_reason).toBe('One or more photos were rejected')
  })

  it('admin sees any listing; flags come back as seller-facing text', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId, { other: true })
    await submitListing(db, id, 1)
    const admin = await asUser(await createUser({ email: 'boss@x.ng', role: 'admin' }))
    const res = await getListingForViewer(admin, id)
    if (!res.ok || res.value.view !== 'owner') throw new Error('expected owner view')
    expect(res.value.status).toBe('in_review')
    expect(res.value.review_flags).toEqual(['Our team is checking the make and model you typed in'])
  })
})
