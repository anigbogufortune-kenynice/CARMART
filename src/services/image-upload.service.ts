import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { UploadRequestSchema, type ImageStatus, type UploadRequest } from '@/types/domain'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Listing photo uploads (docs/systems/image-verification.md → request_upload, complete, owner_delete).
 * Every guard lives in the security-definer RPCs; this module adds storage calls and error mapping.
 */

const QUARANTINE = 'listing-quarantine'
const PUBLIC = 'listing-public'
/** Supabase signed upload URLs are valid for 2 hours (not configurable). */
const UPLOAD_URL_TTL_SECONDS = 7200
const THUMBNAIL_TTL_SECONDS = 300

export type UploadTicket = { image_id: string; upload_url: string; expires_in: number }
export type PhotoStatus = {
  image_id: string
  position: number
  status: ImageStatus
  status_reason: string | null
  thumbnail_url: string | null
}

const RPC_ERRORS: Record<string, AppError> = {
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Photo or listing not found' },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Your shop can’t upload photos right now' },
  INVALID_STATE: { code: 'INVALID_STATE', message: 'Photos can’t be changed while this listing is being checked' },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: 'Photos must be JPEG, PNG or WebP and 10 MB or smaller' },
  PHOTO_COUNT: { code: 'PHOTO_COUNT', message: 'A listing can have up to 20 photos' },
  UPLOAD_LIMIT: { code: 'UPLOAD_LIMIT', message: 'You’ve reached today’s upload limit (60 photos). Try again tomorrow.' },
  UPLOAD_MISSING: { code: 'UPLOAD_MISSING', message: 'We didn’t receive that photo. Please upload it again.' },
}

function rpcError(error: PostgrestError): AppError {
  const code = Object.keys(RPC_ERRORS).find((c) => error.message === c || error.message.includes(c))
  return code ? RPC_ERRORS[code] : { code: 'INTERNAL_ERROR', message: error.message }
}

async function imageOnListing(db: SupabaseClient, listingId: string, imageId: string) {
  const { data } = await db
    .from('listing_images')
    .select('id,quarantine_path')
    .eq('id', imageId)
    .eq('listing_id', listingId)
    .is('deleted_at', null)
    .maybeSingle()
  return data as { id: string; quarantine_path: string } | null
}

/** Create an `uploaded` photo and a signed upload URL for its quarantine object. */
export async function requestUpload(db: SupabaseClient, listingId: string, input: UploadRequest): Promise<Result<UploadTicket, AppError>> {
  const parsed = UploadRequestSchema.safeParse(input)
  if (!parsed.success) return err(RPC_ERRORS.VALIDATION_ERROR)
  const { data, error } = await db.rpc('request_image_upload', {
    p_listing_id: listingId, p_mime_type: parsed.data.mime_type, p_bytes: parsed.data.bytes,
  })
  if (error) return err(rpcError(error))
  const image = data as { id: string; quarantine_path: string }
  const signed = await db.storage.from(QUARANTINE).createSignedUploadUrl(image.quarantine_path)
  if (signed.error) return err({ code: 'INTERNAL_ERROR', message: signed.error.message })
  return ok({ image_id: image.id, upload_url: signed.data.signedUrl, expires_in: UPLOAD_URL_TTL_SECONDS })
}

/** Confirm the upload and queue the checks. Idempotent. Missing or mismatched object → UPLOAD_MISSING. */
export async function completeUpload(
  db: SupabaseClient, listingId: string, imageId: string,
): Promise<Result<{ image_id: string; status: 'checking' }, AppError>> {
  const image = await imageOnListing(db, listingId, imageId)
  if (!image) return err(RPC_ERRORS.NOT_FOUND)
  const { data, error } = await db.rpc('enqueue_image_check', { p_image_id: imageId })
  if (error) return err(rpcError(error))
  const row = (data as { status: ImageStatus }[])[0]
  if (row?.status !== 'checking') {
    // EC-I2: the object doesn't match what was declared. The photo is rejected; drop the object.
    await db.storage.from(QUARANTINE).remove([image.quarantine_path])
    return err({ code: 'UPLOAD_MISSING', message: 'That upload didn’t match. Please upload the photo again.' })
  }
  return ok({ image_id: imageId, status: 'checking' })
}

/** The owner's view of a listing's photos, in display order, with thumbnails. */
export async function getPhotoStatus(db: SupabaseClient, listingId: string): Promise<Result<PhotoStatus[], AppError>> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return err(RPC_ERRORS.UNAUTHENTICATED)
  const { data: listing } = await db
    .from('listings')
    .select('id, shop:shops!inner(owner_id)')
    .eq('id', listingId)
    .eq('shop.owner_id', auth.user.id)
    .maybeSingle()
  if (!listing) return err({ code: 'NOT_FOUND', message: 'Listing not found' })

  const { data, error } = await db
    .from('listing_images')
    .select('id,position,status,status_reason,quarantine_path,public_paths')
    .eq('listing_id', listingId)
    .is('deleted_at', null)
    .order('position')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const rows = (data ?? []) as {
    id: string; position: number; status: ImageStatus; status_reason: string | null
    quarantine_path: string; public_paths: { sm?: string } | null
  }[]

  const needsSigned = rows.filter((r) => r.status !== 'uploaded' && !(r.status === 'passed' && r.public_paths?.sm))
  const signed = new Map<string, string>()
  if (needsSigned.length) {
    const res = await db.storage.from(QUARANTINE).createSignedUrls(needsSigned.map((r) => r.quarantine_path), THUMBNAIL_TTL_SECONDS)
    for (const s of res.data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  return ok(rows.map((r) => ({
    image_id: r.id,
    position: r.position,
    status: r.status,
    status_reason: r.status_reason,
    thumbnail_url: r.status === 'passed' && r.public_paths?.sm
      ? db.storage.from(PUBLIC).getPublicUrl(r.public_paths.sm).data.publicUrl
      : signed.get(r.quarantine_path) ?? null,
  })))
}

/** Soft-delete a photo (a live listing keeps at least 4 passed photos). */
export async function deletePhoto(db: SupabaseClient, listingId: string, imageId: string): Promise<Result<null, AppError>> {
  const image = await imageOnListing(db, listingId, imageId)
  if (!image) return err(RPC_ERRORS.NOT_FOUND)
  const { error } = await db.rpc('delete_listing_image', { p_image_id: imageId })
  if (error) {
    const mapped = rpcError(error)
    if (mapped.code === 'PHOTO_COUNT') return err({ code: 'PHOTO_COUNT', message: 'A live listing needs at least 4 approved photos' })
    return err(mapped)
  }
  return ok(null)
}

/** Set the display order. The list must name exactly the listing's non-deleted photos. */
export async function reorderPhotos(
  db: SupabaseClient, listingId: string, imageIds: string[],
): Promise<Result<{ image_id: string; position: number }[], AppError>> {
  const { data, error } = await db.rpc('reorder_listing_images', { p_listing_id: listingId, p_image_ids: imageIds })
  if (error) {
    const mapped = rpcError(error)
    if (mapped.code === 'VALIDATION_ERROR') return err({ code: 'VALIDATION_ERROR', message: 'The new order must list every photo exactly once' })
    return err(mapped)
  }
  return ok(((data ?? []) as { id: string; position: number }[]).map((r) => ({ image_id: r.id, position: r.position })))
}
