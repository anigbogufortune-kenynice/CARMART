import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

const listing = async (id: string) =>
  (await adminDb().from('listings').select('status,status_reason,live_at,expires_at,version,review_flags').eq('id', id).single()).data!
const evaluate = (id: string) => adminDb().rpc('evaluate_listing', { p_listing_id: id })
const setPhotos = (id: string, status: string, limit?: number) =>
  limit === undefined
    ? adminDb().from('listing_images').update({ status }).eq('listing_id', id)
    : adminDb().from('listing_images').select('id').eq('listing_id', id).order('position').limit(limit)
      .then(({ data }) => adminDb().from('listing_images').update({ status }).in('id', (data ?? []).map((r) => r.id)))

describe('evaluate_listing rules', () => {
  it('rule 4: all passed, no flags → live with live_at and expires_at ≈ now + 60 days', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId)
    await submitListing(db, id, 1)
    const l = await listing(id)
    expect(l).toMatchObject({ status: 'live', status_reason: null, version: 3 })
    const days = (new Date(l.expires_at!).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(59.9)
    expect(days).toBeLessThan(60.1)
    expect(Date.now() - new Date(l.live_at!).getTime()).toBeLessThan(60_000)
  })

  it('rule 2: a photo still checking → unchanged; then its pass makes it live', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId, { photoStatus: 'passed' })
    await setPhotos(id, 'checking', 1)
    await submitListing(db, id, 1)
    expect((await listing(id)).status).toBe('checking')
    await setPhotos(id, 'passed')
    await evaluate(id)
    expect((await listing(id)).status).toBe('live')
  })

  it('rule 1: a rejected photo → rejected with the plain reason', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId)
    await setPhotos(id, 'checking', 1)
    await submitListing(db, id, 1)
    await setPhotos(id, 'rejected', 1)
    await evaluate(id)
    expect(await listing(id)).toMatchObject({ status: 'rejected', status_reason: 'One or more photos were rejected' })
  })

  it('rule 3: all passed but a flag → in_review; evaluating again changes nothing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId, { other: true })
    await submitListing(db, id, 1)
    const once = await listing(id)
    expect(once).toMatchObject({ status: 'in_review', review_flags: ['other_make_model'] })
    await evaluate(id)
    expect(await listing(id)).toEqual(once)
  })

  it('a photo in review → in_review', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId)
    await setPhotos(id, 'in_review', 1)
    await submitListing(db, id, 1)
    expect((await listing(id)).status).toBe('in_review')
  })

  it('clients cannot call evaluate_listing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au')
    const id = await completeDraft(db, shopId)
    expect((await db.rpc('evaluate_listing', { p_listing_id: id })).error).not.toBeNull()
  })
})
