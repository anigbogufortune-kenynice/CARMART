import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { Agent, fetch as undiciFetch } from 'undici'
import { publishVariants, unpublishListing } from '@/server/jobs/image-verification/publish'
import { resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

/**
 * A service-role client on its own connection pool: an earlier storage test that rejects an upload
 * can leave a broken keep-alive connection in the shared pool, and storage calls here would reuse it.
 */
function freshAdmin() {
  const agent = new Agent()
  const fetchFresh = ((input: string | URL, init?: object) => undiciFetch(input, { ...init, dispatcher: agent })) as unknown as typeof fetch
  return createClient(process.env.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchFresh },
  })
}

afterEach(async () => {
  await resetDb()
})

describe('unpublishListing', () => {
  it('deletes every public variant of the listing and clears public_paths; a second run deletes nothing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const id = await completeDraft(db, shopId)
    const admin = freshAdmin()
    const images = (await admin.from('listing_images').select('id').eq('listing_id', id)).data ?? []
    // Real (tiny) WebP files, published the same way the job runner does it.
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).webp().toBuffer()
    for (const img of images) {
      const paths = await publishVariants(admin, id, img.id as string, { sm: webp, md: webp, lg: webp })
      await admin.from('listing_images').update({ public_paths: paths }).eq('id', img.id)
    }

    expect(await unpublishListing(admin, id)).toEqual({ deleted: 12 })
    const left = (await admin.from('listing_images').select('public_paths').eq('listing_id', id)).data ?? []
    expect(left.every((r) => r.public_paths === null)).toBe(true)
    expect(await unpublishListing(admin, id)).toEqual({ deleted: 0 })
  }, 90_000)
})
