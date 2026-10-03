import { afterEach, describe, expect, it } from 'vitest'
import { reorderPhotos } from '@/services/image-upload.service'
import { createDraft } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function listingWithPhotos(email = 'a@x.au') {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0]}`, city: 'Ikeja', state: 'Lagos' })
  if (!shop.ok) throw new Error(shop.error.message)
  const draft = await createDraft(db, {})
  if (!draft.ok) throw new Error(draft.error.message)
  const rows = [0, 1, 2].map((i) => ({
    listing_id: draft.value.id, shop_id: shop.value.id, position: i, quarantine_path: `${shop.value.id}/${draft.value.id}/p${i}`,
    mime_type: 'image/jpeg', bytes: 1000, status: 'checking',
  }))
  const inserted = await adminDb().from('listing_images').insert(rows)
  if (inserted.error) throw new Error(inserted.error.message)
  const { data } = await adminDb().from('listing_images').select('id').eq('listing_id', draft.value.id).order('position')
  const [a, b, c] = (data ?? []).map((r) => r.id as string)
  return { db, listingId: draft.value.id, a, b, c }
}

describe('reorderPhotos', () => {
  it('sets positions in the given order', async () => {
    const { db, listingId, a, b, c } = await listingWithPhotos()
    expect(await reorderPhotos(db, listingId, [c, a, b])).toEqual({
      ok: true, value: [{ image_id: c, position: 0 }, { image_id: a, position: 1 }, { image_id: b, position: 2 }],
    })
    const { data } = await adminDb().from('listing_images').select('id').eq('listing_id', listingId).order('position')
    expect(data!.map((r) => r.id)).toEqual([c, a, b])
  })

  it('VALIDATION_ERROR when an id is missing, repeated or foreign', async () => {
    const { db, listingId, a, b, c } = await listingWithPhotos()
    expect(await reorderPhotos(db, listingId, [a, b])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await reorderPhotos(db, listingId, [a, a, b])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await reorderPhotos(db, listingId, [a, b, c, crypto.randomUUID()])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('NOT_FOUND for someone else’s listing', async () => {
    const { listingId, a, b, c } = await listingWithPhotos()
    const other = await listingWithPhotos('b@x.au')
    expect(await reorderPhotos(other.db, listingId, [a, b, c])).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
