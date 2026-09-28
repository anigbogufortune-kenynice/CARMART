/**
 * Public photo variants (docs/schema.md → Storage buckets; INV-I1). Only the job runner writes
 * `listing-public`, and only metadata-free WebP files (see process-image.ts → stripAndEncode).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient } from '../supabase-admin'
import type { Variants } from './process-image'

export const PUBLIC_BUCKET = 'listing-public'
const SIZES = ['sm', 'md', 'lg'] as const
export type PublicPaths = Record<(typeof SIZES)[number], string>

export function publicPaths(listingId: string, imageId: string): PublicPaths {
  return { sm: `${listingId}/${imageId}-sm.webp`, md: `${listingId}/${imageId}-md.webp`, lg: `${listingId}/${imageId}-lg.webp` }
}

/** Upload all three variants (before the database points at them). Throws on any failure. */
export async function publishVariants(db: SupabaseClient, listingId: string, imageId: string, variants: Variants): Promise<PublicPaths> {
  const paths = publicPaths(listingId, imageId)
  for (const size of SIZES) {
    const { error } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(paths[size], variants[size], { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
    if (error) throw new Error(`publish ${size} failed: ${error.message}`)
  }
  return paths
}

export async function removeVariants(db: SupabaseClient, paths: PublicPaths): Promise<void> {
  const { error } = await db.storage.from(PUBLIC_BUCKET).remove(Object.values(paths))
  if (error) throw new Error(`remove variants failed: ${error.message}`)
}

/** Delete one photo's public variants and clear its paths. Idempotent. */
export async function unpublishImage(db: SupabaseClient, imageId: string): Promise<{ found: boolean }> {
  const { data } = await db.from('listing_images').select('id,listing_id').eq('id', imageId).maybeSingle()
  if (!data) return { found: false }
  await removeVariants(db, publicPaths(data.listing_id as string, imageId))
  const { error } = await db.from('listing_images').update({ public_paths: null }).eq('id', imageId)
  if (error) throw new Error(`unpublish update failed: ${error.message}`)
  return { found: true }
}

/** Entry point for POST /api/internal/unpublish-image. */
export async function runUnpublish(imageId: string): Promise<{ found: boolean }> {
  return unpublishImage(adminClient(), imageId)
}
