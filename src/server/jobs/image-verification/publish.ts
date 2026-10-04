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

/**
 * Delete every public variant of a listing's photos (deleted photos included) and clear their paths.
 * Idempotent: returns how many storage objects were actually deleted.
 */
export async function unpublishListing(db: SupabaseClient, listingId: string): Promise<{ deleted: number }> {
  const { data, error } = await db.from('listing_images').select('id').eq('listing_id', listingId)
  if (error) throw new Error(`unpublish listing read failed: ${error.message}`)
  const ids = (data ?? []).map((r) => r.id as string)
  if (ids.length === 0) return { deleted: 0 }
  const paths = ids.flatMap((id) => Object.values(publicPaths(listingId, id)))
  const removed = await db.storage.from(PUBLIC_BUCKET).remove(paths)
  if (removed.error) throw new Error(`remove variants failed: ${removed.error.message}`)
  const cleared = await db.from('listing_images').update({ public_paths: null }).eq('listing_id', listingId).not('public_paths', 'is', null)
  if (cleared.error) throw new Error(`unpublish listing update failed: ${cleared.error.message}`)
  return { deleted: removed.data?.length ?? 0 }
}

/** Entry point for POST /api/internal/unpublish-listing. */
export async function runUnpublishListing(listingId: string): Promise<{ deleted: number }> {
  return unpublishListing(adminClient(), listingId)
}

/** Entry point for POST /api/internal/unpublish-image. */
export async function runUnpublish(imageId: string): Promise<{ found: boolean }> {
  return unpublishImage(adminClient(), imageId)
}
