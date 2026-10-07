import type { SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Admin moderation (docs/api-contracts.md → Admin). Public API is capped at 8 exports:
 * listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension,
 * setListingCap, listAuditLog (added by their issues).
 */

export type QueueName = 'shops' | 'images' | 'duplicate-vins' | 'other-make-model' | 'reports'
export type Page<T> = { items: T[]; page: { number: number; size: number; total: number } }

export type ShopQueueItem = {
  id: string
  name: string
  slug: string
  city: string
  state: string
  submitted_at: string
  owner_name: string
  phone_verified: boolean
}

export type ImageQueueItem = {
  id: string
  position: number
  created_at: string
  signed_url: string | null
  listing: { id: string; title: string; status: string }
  shop: { id: string; name: string; slug: string }
  car_check: { is_car?: boolean; confidence?: number; view?: string; is_screen_or_print?: boolean; plate_visible?: boolean; face_visible?: boolean } | null
  ai_check: { score?: number } | null
  metadata_signals: { has_exif?: boolean; camera_make?: string | null; camera_model?: string | null; software?: string | null; c2pa_present?: boolean } | null
  phash_match: {
    distance: number; matched_image_id: string; matched_shop_id: string
    matched_shop_name: string | null; matched_listing_id: string | null; matched_signed_url: string | null
  } | null
  thresholds: { aiReviewThreshold?: number; aiRejectThreshold?: number; carPassConfidence?: number; carRejectConfidence?: number } | null
  decision_reason: string | null
}

const PAGE_SIZE = 24
const QUARANTINE_BUCKET = 'listing-quarantine'
const SIGNED_URL_SECONDS = 600

async function requireAdmin(db: SupabaseClient): Promise<AppError | null> {
  const { data, error } = await db.rpc('is_admin')
  if (error) return { code: 'INTERNAL_ERROR', message: error.message }
  return data === true ? null : { code: 'FORBIDDEN', message: 'Admins only' }
}

async function shopsQueue(db: SupabaseClient, page: number): Promise<Result<Page<ShopQueueItem>, AppError>> {
  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await db
    .from('shops')
    .select('id,name,slug,city,state,submitted_at,owner:profiles!shops_owner_id_fkey(display_name,phone_verified_at)', { count: 'exact' })
    .eq('status', 'pending_approval')
    .order('submitted_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  type Row = Omit<ShopQueueItem, 'owner_name' | 'phone_verified'> & { owner: { display_name: string; phone_verified_at: string | null } | null }
  const items = ((data ?? []) as unknown as Row[]).map(({ owner, ...rest }) => ({
    ...rest,
    owner_name: owner?.display_name ?? '',
    phone_verified: !!owner?.phone_verified_at,
  }))
  return ok({ items, page: { number: page, size: PAGE_SIZE, total: count ?? 0 } })
}

type NameRow = { name: string } | null
type ImageRow = {
  id: string; position: number; created_at: string; quarantine_path: string
  listing: { id: string; status: string; year: number | null; make_other: string | null; model_other: string | null; make: NameRow; model: NameRow }
  shop: { id: string; name: string; slug: string }
}
type CheckRow = Pick<ImageQueueItem, 'car_check' | 'ai_check' | 'metadata_signals' | 'thresholds' | 'decision_reason'> & {
  image_id: string; phash_match: { matched_image_id: string; matched_shop_id: string; distance: number } | null
}
type MatchedRow = { id: string; listing_id: string; quarantine_path: string; shop: { name: string } | null }

const carTitle = (l: ImageRow['listing']) =>
  [l.year, l.make_other ?? l.make?.name, l.model_other ?? l.model?.name].filter(Boolean).join(' ') || 'Untitled car'

/** Photos waiting for a human: in_review, not deleted, oldest first, with the pipeline's evidence. */
async function imagesQueue(db: SupabaseClient, page: number): Promise<Result<Page<ImageQueueItem>, AppError>> {
  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await db
    .from('listing_images')
    .select('id,position,created_at,quarantine_path,' +
      'listing:listings(id,status,year,make_other,model_other,make:vehicle_makes(name),model:vehicle_models(name)),shop:shops(id,name,slug)',
    { count: 'exact' })
    .eq('status', 'in_review').is('deleted_at', null)
    .order('created_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const rows = (data ?? []) as unknown as ImageRow[]
  if (rows.length === 0) return ok({ items: [], page: { number: page, size: PAGE_SIZE, total: count ?? 0 } })

  // The latest check per photo (newest first, first one wins).
  const checksRes = await db.from('image_checks')
    .select('image_id,car_check,ai_check,metadata_signals,phash_match,thresholds,decision_reason')
    .in('image_id', rows.map((r) => r.id)).order('created_at', { ascending: false })
  if (checksRes.error) return err({ code: 'INTERNAL_ERROR', message: checksRes.error.message })
  const checks = new Map<string, CheckRow>()
  for (const c of (checksRes.data ?? []) as CheckRow[]) if (!checks.has(c.image_id)) checks.set(c.image_id, c)

  const matchedIds = Array.from(new Set(Array.from(checks.values()).flatMap((c) => (c.phash_match ? [c.phash_match.matched_image_id] : []))))
  const matchedRes = matchedIds.length
    ? await db.from('listing_images').select('id,listing_id,quarantine_path,shop:shops(name)').in('id', matchedIds)
    : { data: [], error: null }
  if (matchedRes.error) return err({ code: 'INTERNAL_ERROR', message: matchedRes.error.message })
  const matched = new Map(((matchedRes.data ?? []) as unknown as MatchedRow[]).map((m) => [m.id, m]))

  const paths = [...rows.map((r) => r.quarantine_path), ...Array.from(matched.values()).map((m) => m.quarantine_path)]
  const signedRes = await db.storage.from(QUARANTINE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (signedRes.error) return err({ code: 'INTERNAL_ERROR', message: signedRes.error.message })
  const signed = new Map(signedRes.data.map((s) => [s.path, s.signedUrl]))

  const items = rows.map((r): ImageQueueItem => {
    const c = checks.get(r.id)
    const m = c?.phash_match ? matched.get(c.phash_match.matched_image_id) : undefined
    return {
      id: r.id, position: r.position, created_at: r.created_at, signed_url: signed.get(r.quarantine_path) ?? null,
      listing: { id: r.listing.id, title: carTitle(r.listing), status: r.listing.status },
      shop: r.shop,
      car_check: c?.car_check ?? null, ai_check: c?.ai_check ?? null, metadata_signals: c?.metadata_signals ?? null,
      thresholds: c?.thresholds ?? null, decision_reason: c?.decision_reason ?? null,
      phash_match: c?.phash_match ? {
        ...c.phash_match,
        matched_shop_name: m?.shop?.name ?? null, matched_listing_id: m?.listing_id ?? null,
        matched_signed_url: m ? signed.get(m.quarantine_path) ?? null : null,
      } : null,
    }
  })
  return ok({ items, page: { number: page, size: PAGE_SIZE, total: count ?? 0 } })
}

/** An admin review queue, oldest first. Queues other than 'shops' arrive with later issues. */
export async function listQueue(db: SupabaseClient, queue: QueueName, page = 1): Promise<Result<Page<unknown>, AppError>> {
  const denied = await requireAdmin(db)
  if (denied) return err(denied)
  const p = Math.max(1, Math.floor(page))
  switch (queue) {
    case 'shops':
      return shopsQueue(db, p)
    case 'images':
      return imagesQueue(db, p)
    default:
      return err({ code: 'NOT_FOUND', message: `Unknown queue: ${queue}` })
  }
}

const DECISION_ERRORS: Record<string, AppError> = {
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Admins only' },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Not found' },
  INVALID_STATE: { code: 'INVALID_STATE', message: 'This item has already been decided' },
  REASON_REQUIRED: { code: 'REASON_REQUIRED', message: 'Give a reason of 5–500 characters' },
}

function mapDecisionError(message: string): AppError {
  const code = Object.keys(DECISION_ERRORS).find((c) => message.includes(c))
  return code ? DECISION_ERRORS[code] : { code: 'INTERNAL_ERROR', message }
}

export type ShopDecision = 'approve' | 'reject'

/** Approve or reject a pending shop (audit row + owner email written atomically in SQL). */
export async function decideShop(
  db: SupabaseClient,
  shopId: string,
  decision: ShopDecision,
  reason?: string,
): Promise<Result<{ id: string; status: string }, AppError>> {
  if (decision === 'reject' && (!reason || reason.trim().length < 5 || reason.trim().length > 500)) {
    return err(DECISION_ERRORS.REASON_REQUIRED)
  }
  const { data, error } =
    decision === 'approve'
      ? await db.rpc('admin_approve_shop', { p_shop_id: shopId })
      : await db.rpc('admin_reject_shop', { p_shop_id: shopId, p_reason: reason })
  if (error) return err(mapDecisionError(error.message))
  const shop = data as { id: string; status: string }
  return ok({ id: shop.id, status: shop.status })
}

export type ImageDecision = 'approve' | 'reject'

/**
 * Approve or reject a reviewed photo. Queues a forced-decision job (the runner publishes or
 * unpublishes and re-evaluates the listing); the audit row is written in the same transaction.
 */
export async function decideImage(
  db: SupabaseClient,
  imageId: string,
  decision: ImageDecision,
  reason?: string,
): Promise<Result<{ id: string; status: string }, AppError>> {
  if (decision === 'reject' && (!reason || reason.trim().length < 5 || reason.trim().length > 500)) {
    return err(DECISION_ERRORS.REASON_REQUIRED)
  }
  const { data, error } =
    decision === 'approve'
      ? await db.rpc('admin_approve_image', { p_image_id: imageId })
      : await db.rpc('admin_reject_image', { p_image_id: imageId, p_reason: reason })
  if (error) return err(mapDecisionError(error.message))
  const img = data as { id: string; status: string }
  return ok({ id: img.id, status: img.status })
}
