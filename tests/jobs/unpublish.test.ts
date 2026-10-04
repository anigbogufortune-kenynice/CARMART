import { afterEach, describe, expect, it } from 'vitest'
import { publicPaths, unpublishListing, PUBLIC_BUCKET } from '@/server/jobs/image-verification/publish'
import { adminDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

describe('unpublishListing', () => {
  it('deletes every public variant of the listing and clears public_paths; a second run deletes nothing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId)
    const admin = adminDb()
    const images = (await admin.from('listing_images').select('id').eq('listing_id', id)).data ?? []
    const bytes = Buffer.from('RIFF\x0c\x00\x00\x00WEBPVP8 ', 'binary')
    for (const img of images) {
      const paths = publicPaths(id, img.id as string)
      for (const p of Object.values(paths)) {
        const up = await admin.storage.from(PUBLIC_BUCKET).upload(p, bytes, { contentType: 'image/webp', upsert: true })
        if (up.error) throw new Error(up.error.message)
      }
      await admin.from('listing_images').update({ public_paths: paths }).eq('id', img.id)
    }

    expect(await unpublishListing(adminDb(), id)).toEqual({ deleted: 12 })
    const left = (await adminDb().from('listing_images').select('public_paths').eq('listing_id', id)).data ?? []
    expect(left.every((r) => r.public_paths === null)).toBe(true)
    expect(await unpublishListing(adminDb(), id)).toEqual({ deleted: 0 })
  }, 90_000)
})
