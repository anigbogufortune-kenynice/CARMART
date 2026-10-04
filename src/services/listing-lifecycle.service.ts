import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { err, type AppError, type Result } from '@/types/result'
import { getMyListing, type OwnListing } from './listing.service'

/**
 * Listing status transitions (docs/systems/listing-lifecycle.md). Every guard lives in a
 * security-definer RPC (INV-L6); this module maps RPC errors and returns the owner view.
 */

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Sign in to continue',
  NOT_FOUND: 'Listing not found',
  INVALID_STATE: 'This listing can’t be submitted right now',
  VERSION_CONFLICT: 'This listing changed in another tab. Reload the page and try again.',
  SHOP_NOT_APPROVED: 'Your shop must be approved before listings can go live',
  PHOTO_COUNT: 'Add 4 to 20 photos before submitting',
  LISTING_LIMIT_REACHED: 'You’ve reached your shop’s limit of active listings',
  DUPLICATE_LISTING: 'You already have an active listing for this VIN',
}

const SOLD_MESSAGES: Record<string, string> = { INVALID_STATE: 'Only a live listing can be marked as sold' }

function rpcError(error: PostgrestError): AppError {
  const incomplete = /^LISTING_INCOMPLETE: (.+)$/.exec(error.message)
  if (incomplete) return { code: 'LISTING_INCOMPLETE', message: `Complete these fields first: ${incomplete[1]}` }
  const code = Object.keys(MESSAGES).find((c) => error.message === c)
  return code ? { code, message: MESSAGES[code] } : { code: 'INTERNAL_ERROR', message: error.message }
}

/** draft | rejected → checking, then evaluated (live / in_review / rejected / still checking). */
export async function submitListing(db: SupabaseClient, listingId: string, version: number): Promise<Result<OwnListing, AppError>> {
  const { error } = await db.rpc('submit_listing', { p_listing_id: listingId, p_version: version })
  if (error) return err(rpcError(error))
  return getMyListing(db, listingId)
}

/** live → sold (docs/systems/listing-lifecycle.md → mark_sold). Stays readable by URL for 7 days. */
export async function markSold(db: SupabaseClient, listingId: string, version: number): Promise<Result<OwnListing, AppError>> {
  const { error } = await db.rpc('mark_listing_sold', { p_listing_id: listingId, p_version: version })
  if (error) {
    const mapped = rpcError(error)
    return err(SOLD_MESSAGES[mapped.code] ? { code: mapped.code, message: SOLD_MESSAGES[mapped.code] } : mapped)
  }
  return getMyListing(db, listingId)
}
