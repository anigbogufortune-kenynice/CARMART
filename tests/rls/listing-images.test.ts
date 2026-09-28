import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { completeUpload, requestUpload } from '@/services/image-upload.service'
import { createDraft } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

const PHOTO = readFileSync('tests/fixtures/images/car-exterior.jpg')

/** Fail fast with the step name instead of a bare 30 s timeout. */
function step<T>(name: string, p: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`step hung: ${name}`)), ms))])
}

afterEach(async () => {
  await resetDb()
})

async function uploadedPhoto() {
  const db = await step('user', asUser(await step('createUser', createUser({ email: 'a@x.au' }))))
  const shop = await step('shop', createShop(db, { name: 'Coastal Cars', slug: 'coastal-cars', suburb: 'Parramatta', state: 'NSW', postcode: '2150' }))
  if (!shop.ok) throw new Error(shop.error.message)
  const draft = await step('draft', createDraft(db, {}))
  if (!draft.ok) throw new Error(draft.error.message)
  const req = await step('request', requestUpload(db, draft.value.id, { mime_type: 'image/jpeg', bytes: PHOTO.length }))
  if (!req.ok) throw new Error(req.error.message)
  const token = new URL(req.value.upload_url).searchParams.get('token')!
  const path = `${shop.value.id}/${draft.value.id}/${req.value.image_id}`
  const up = await step('signed upload', db.storage.from('listing-quarantine').uploadToSignedUrl(path, token, PHOTO, { contentType: 'image/jpeg' }))
  expect(up.error).toBeNull()
  return { db, path, token, listingId: draft.value.id, imageId: req.value.image_id }
}

describe('quarantine storage and photo rows', () => {
  it('anon and other users cannot read quarantine objects or photo rows', async () => {
    const { path, imageId } = await uploadedPhoto()
    expect((await anonDb().storage.from('listing-quarantine').download(path)).error).not.toBeNull()
    expect((await anonDb().from('listing_images').select('id')).data ?? []).toHaveLength(0)
    const other = await asUser(await createUser({ email: 'b@x.au' }))
    expect((await other.storage.from('listing-quarantine').download(path)).error).not.toBeNull()
    expect((await other.from('listing_images').select('id').eq('id', imageId)).data ?? []).toHaveLength(0)
  })

  it('clients cannot write listing-public, or write image_checks and upload_events directly', async () => {
    const { db, listingId, imageId } = await step('setup', uploadedPhoto(), 20000)
    await step('complete', completeUpload(db, listingId, imageId))
    const pub = await step('public upload', db.storage.from('listing-public').upload(`${listingId}/x-sm.webp`, PHOTO, { contentType: 'image/webp' }))
    expect(pub.error).not.toBeNull()
    expect((await step('insert check', db.from('image_checks').insert({ image_id: imageId }))).error).not.toBeNull()
    expect((await step('insert event', db.from('upload_events').insert({ shop_id: listingId }))).error).not.toBeNull()
    expect((await step('update status', db.from('listing_images').update({ status: 'passed' }).eq('id', imageId)))).toMatchObject({ error: expect.anything() })
    const own = await step('view', db.from('image_check_status').select('state').eq('image_id', imageId))
    expect(own.data).toEqual([{ state: 'queued' }])
    expect((await step('admin read', adminDb().from('image_checks').select('id').eq('image_id', imageId))).data).toHaveLength(1)
  })

  it('another user cannot get an upload URL for the owner’s path; the token can’t overwrite (runs last)', async () => {
    const { db, path, token } = await uploadedPhoto()
    const other = await asUser(await createUser({ email: 'b@x.au' }))
    expect((await step('foreign sign', other.storage.from('listing-quarantine').createSignedUploadUrl(path))).error).not.toBeNull()
    const again = await step('reuse token', db.storage.from('listing-quarantine').uploadToSignedUrl(path, token, PHOTO, { contentType: 'image/jpeg' }))
    expect(again.error).not.toBeNull()
  })
})
