import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

const notes = async (ref: string) =>
  (await adminDb().from('notifications').select('kind,payload,user_id').eq('ref_id', ref)).data ?? []

describe('listing status emails (enqueued by evaluate_listing)', () => {
  it('going live enqueues one listing_live for the owner', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId)
    await submitListing(db, id, 1)
    const n = await notes(id)
    expect(n.map((x) => x.kind)).toEqual(['listing_live'])
    expect(n[0].payload).toMatchObject({ title: '2019 Toyota HiLux', listingId: id })
  })

  it('rejection enqueues listing_rejected with the per-photo reasons', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId)
    const first = (await adminDb().from('listing_images').select('id').eq('listing_id', id).order('position').limit(1)).data![0]
    await adminDb().from('listing_images').update({ status: 'rejected', status_reason: 'Stock photo' }).eq('id', first.id)
    await submitListing(db, id, 1)
    const n = await notes(id)
    expect(n.map((x) => x.kind)).toEqual(['listing_rejected'])
    expect(n[0].payload).toMatchObject({ photos: [{ position: 1, reason: 'Stock photo' }] })
  })

  it('in_review is announced once, even when evaluated again', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId, { other: true })
    await submitListing(db, id, 1)
    await adminDb().rpc('evaluate_listing', { p_listing_id: id })
    await adminDb().from('listings').update({ status: 'checking' }).eq('id', id)
    await adminDb().rpc('evaluate_listing', { p_listing_id: id })
    expect((await notes(id)).map((x) => x.kind)).toEqual(['listing_in_review'])
  })
})
