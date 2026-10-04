import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { publishVariants, unpublishListing } from '@/server/jobs/image-verification/publish'
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
    // Real (tiny) WebP files, published the same way the job runner does it.
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).webp().toBuffer()
    for (const img of images) {
      const paths = await publishVariants(admin, id, img.id as string, { sm: webp, md: webp, lg: webp })
      await admin.from('listing_images').update({ public_paths: paths }).eq('id', img.id)
    }

    expect(await unpublishListing(adminDb(), id)).toEqual({ deleted: 12 })
    const left = (await adminDb().from('listing_images').select('public_paths').eq('listing_id', id)).data ?? []
    expect(left.every((r) => r.public_paths === null)).toBe(true)
    expect(await unpublishListing(adminDb(), id)).toEqual({ deleted: 0 })
  }, 90_000)
})
