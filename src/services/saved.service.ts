import type { SupabaseClient } from '@supabase/supabase-js'
import type { ListingCard } from './search.service'
import { err, ok, type AppError, type Page, type Result } from '@/types/result'

/** Saved cars (docs/api-contracts.md → saved-listings). Guards live in the save_listing RPC. */

const PUBLIC_BUCKET = 'listing-public'
const PAGE_SIZE = 24

export type SavedCar = ListingCard & { unavailable: boolean; saved_at: string }

/** Save a publicly visible listing; `created` is false when it was already saved. */
export async function saveListing(db: SupabaseClient, listingId: string): Promise<Result<{ created: boolean }, AppError>> {
  const { data, error } = await db.rpc('save_listing', { p_listing_id: listingId })
  if (error) {
    if (error.message === 'NOT_FOUND') return err({ code: 'NOT_FOUND', message: 'Listing not found' })
    if (error.message === 'UNAUTHENTICATED') return err({ code: 'UNAUTHENTICATED', message: 'Sign in to save cars' })
    return err({ code: 'INTERNAL_ERROR', message: error.message })
  }
  return ok({ created: data === true })
}

export async function unsaveListing(db: SupabaseClient, listingId: string): Promise<Result<null, AppError>> {
  const { error } = await db.from('saved_listings').delete().eq('listing_id', listingId)
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok(null)
}

/** Has the signed-in caller saved this listing? (false for visitors) */
export async function isSaved(db: SupabaseClient, listingId: string): Promise<boolean> {
  const { data } = await db.from('saved_listings').select('listing_id').eq('listing_id', listingId).maybeSingle()
  return !!data
}

type Row = Omit<SavedCar, 'thumbnail_url'> & { thumbnail_path: string | null }

/** The caller's saved cars, newest first; ones no longer public are flagged `unavailable`. */
export async function listSaved(db: SupabaseClient, page: number): Promise<Result<Page<SavedCar>, AppError>> {
  const { data, error } = await db.rpc('my_saved_listings', { p_page: page, p_page_size: PAGE_SIZE })
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const result = data as { total: number; items: Row[] }
  return ok({
    items: result.items.map(({ thumbnail_path, ...car }) => ({
      ...car,
      thumbnail_url: !car.unavailable && thumbnail_path ? db.storage.from(PUBLIC_BUCKET).getPublicUrl(thumbnail_path).data.publicUrl : null,
    })),
    page: { number: page, size: PAGE_SIZE, total: result.total },
  })
}
