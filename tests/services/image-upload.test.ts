import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it } from 'vitest'
import { completeUpload, deletePhoto, getPhotoStatus, requestUpload } from '@/services/image-upload.service'
import { createDraft } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

const PHOTO = readFileSync('tests/fixtures/images/car-exterior.jpg')

afterEach(async () => {
  await resetDb()
})

async function ownerWithDraft(email = 'a@x.au') {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0]}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' })
  if (!shop.ok) throw new Error(shop.error.message)
  const draft = await createDraft(db, {})
  if (!draft.ok) throw new Error(draft.error.message)
  return { db, shopId: shop.value.id, listingId: draft.value.id }
}

/** PUT the bytes through the signed URL, as the browser does. */
async function upload(db: SupabaseClient, uploadUrl: string, body: Buffer = PHOTO) {
  const url = new URL(uploadUrl)
  const token = url.searchParams.get('token')!
  const path = decodeURIComponent(url.pathname.split('/object/upload/sign/listing-quarantine/')[1])
  const { error } = await db.storage.from('listing-quarantine').uploadToSignedUrl(path, token, body, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return path
}

describe('requestUpload', () => {
  it('creates an uploaded photo and a signed quarantine upload URL', async () => {
    const { db, listingId } = await ownerWithDraft()
    const res = await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: PHOTO.length })
    expect(res).toMatchObject({ ok: true, value: { image_id: expect.any(String), expires_in: 7200 } })
    if (!res.ok) return
    expect(res.value.upload_url).toContain('/object/upload/sign/listing-quarantine/')
    const events = await adminDb().from('upload_events').select('image_id')
    expect(events.data).toEqual([{ image_id: res.value.image_id }])
  })

  it('VALIDATION_ERROR for a GIF or more than 10 MB', async () => {
    const { db, listingId } = await ownerWithDraft()
    expect(await requestUpload(db, listingId, { mime_type: 'image/gif' as 'image/jpeg', bytes: 10 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: 10_485_761 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('PHOTO_COUNT at 20 non-deleted photos', async () => {
    const { db, shopId, listingId } = await ownerWithDraft()
    const rows = Array.from({ length: 20 }, (_, i) => ({
      listing_id: listingId, shop_id: shopId, position: i, quarantine_path: `${shopId}/${listingId}/seed-${i}`, mime_type: 'image/jpeg', bytes: 1000, status: 'checking',
    }))
    expect((await adminDb().from('listing_images').insert(rows)).error).toBeNull()
    expect(await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: 1000 })).toMatchObject({ ok: false, error: { code: 'PHOTO_COUNT' } })
  })

  it('UPLOAD_LIMIT after 60 uploads in 24 h for the shop', async () => {
    const { db, shopId, listingId } = await ownerWithDraft()
    await adminDb().from('upload_events').insert(Array.from({ length: 60 }, () => ({ shop_id: shopId })))
    expect(await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: 1000 })).toMatchObject({ ok: false, error: { code: 'UPLOAD_LIMIT' } })
  })

  it('NOT_FOUND for someone else’s listing', async () => {
    const { listingId } = await ownerWithDraft()
    const other = await ownerWithDraft('b@x.au')
    expect(await requestUpload(other.db, listingId, { mime_type: 'image/jpeg', bytes: 1000 })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('completeUpload', () => {
  it('UPLOAD_MISSING before the file arrives; then checking with exactly one queued job, idempotently', async () => {
    const { db, listingId } = await ownerWithDraft()
    const req = await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: PHOTO.length })
    if (!req.ok) throw new Error(req.error.message)
    expect(await completeUpload(db, listingId, req.value.image_id)).toMatchObject({ ok: false, error: { code: 'UPLOAD_MISSING' } })

    await upload(db, req.value.upload_url)
    expect(await completeUpload(db, listingId, req.value.image_id)).toEqual({ ok: true, value: { image_id: req.value.image_id, status: 'checking' } })
    expect(await completeUpload(db, listingId, req.value.image_id)).toMatchObject({ ok: true, value: { status: 'checking' } })
    const jobs = await adminDb().from('image_checks').select('state').eq('image_id', req.value.image_id)
    expect(jobs.data).toEqual([{ state: 'queued' }])
  })

  it('a size mismatch rejects the photo and removes the object (EC-I2)', async () => {
    const { db, listingId } = await ownerWithDraft()
    const req = await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: PHOTO.length + 5 })
    if (!req.ok) throw new Error(req.error.message)
    const path = await upload(db, req.value.upload_url)
    expect(await completeUpload(db, listingId, req.value.image_id)).toMatchObject({ ok: false, error: { code: 'UPLOAD_MISSING' } })
    const img = await adminDb().from('listing_images').select('status').eq('id', req.value.image_id).single()
    expect(img.data?.status).toBe('rejected')
    const listed = await adminDb().storage.from('listing-quarantine').list(path.split('/').slice(0, 2).join('/'))
    expect((listed.data ?? []).map((o) => o.name)).not.toContain(req.value.image_id)
  })

  it('NOT_FOUND when the image belongs to a different listing', async () => {
    const { db, listingId } = await ownerWithDraft()
    const req = await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: 1000 })
    if (!req.ok) throw new Error(req.error.message)
    const other = await createDraft(db, {})
    if (!other.ok) throw new Error('draft')
    expect(await completeUpload(db, other.value.id, req.value.image_id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('getPhotoStatus / deletePhoto', () => {
  it('lists photos with a signed thumbnail; a deleted photo disappears', async () => {
    const { db, listingId } = await ownerWithDraft()
    const req = await requestUpload(db, listingId, { mime_type: 'image/jpeg', bytes: PHOTO.length })
    if (!req.ok) throw new Error(req.error.message)
    await upload(db, req.value.upload_url)
    await completeUpload(db, listingId, req.value.image_id)

    const status = await getPhotoStatus(db, listingId)
    expect(status).toMatchObject({ ok: true, value: [{ image_id: req.value.image_id, position: 0, status: 'checking', status_reason: null }] })
    if (!status.ok) return
    expect(status.value[0].thumbnail_url).toContain('/object/sign/listing-quarantine/')

    expect(await deletePhoto(db, listingId, req.value.image_id)).toEqual({ ok: true, value: null })
    expect(await getPhotoStatus(db, listingId)).toEqual({ ok: true, value: [] })
  })

  it('refuses to leave a live listing with fewer than 4 passed photos', async () => {
    const { db, shopId, listingId } = await ownerWithDraft()
    const rows = Array.from({ length: 4 }, (_, i) => ({
      listing_id: listingId, shop_id: shopId, position: i, quarantine_path: `${shopId}/${listingId}/p-${i}`, mime_type: 'image/jpeg', bytes: 1000, status: 'passed',
    }))
    const inserted = await adminDb().from('listing_images').insert(rows).select('id')
    await adminDb().from('listings').update({
      status: 'live', make_other: 'Holden', model_other: 'Kingswood', year: 1975, odometer_km: 1, price_cents: 100, body_type: 'sedan',
      transmission: 'manual', fuel: 'petrol', colour: 'Red', vin: '6H8KZ9A1234567890', state: 'NSW', suburb: 'Parramatta', postcode: '2150',
    }).eq('id', listingId)
    expect(await deletePhoto(db, listingId, inserted.data![0].id)).toMatchObject({ ok: false, error: { code: 'PHOTO_COUNT' } })
  })
})
