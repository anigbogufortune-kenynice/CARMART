import type { SupabaseClient } from '@supabase/supabase-js'
import { SEARCH_PAGE_SIZE, type ListingStatus, type NgState, type SearchQuery } from '@/types/domain'
import { err, ok, type AppError, type Page, type Result } from '@/types/result'

/**
 * Public read side of listings: the listing detail views (and search, issue 026).
 * Every read goes through the caller's client, so RLS decides what is visible:
 * anon/users see live (and recently sold) listings of approved shops; owners and admins see any.
 */

const PUBLIC_BUCKET = 'listing-public'

export type PhotoUrls = { sm: string; md: string; lg: string }
export type PublicPhoto = { id: string; position: number; urls: PhotoUrls }
export type OwnerPhoto = { id: string; position: number; urls: PhotoUrls | null; status: string; status_reason: string | null }
export type ShopSummary = { id: string; name: string; slug: string; city: string; state: NgState; verified: boolean }

type Common = {
  id: string
  title: string
  make: string | null
  model: string | null
  year: number | null
  odometer_km: number | null
  price_cents: number | null
  currency: string
  condition: string | null
  body_type: string | null
  transmission: string | null
  fuel: string | null
  colour: string | null
  vin: string | null
  description: string
  state: NgState | null
  city: string | null
  status: ListingStatus
  live_at: string | null
  sold_at: string | null
  expires_at: string | null
  shop: ShopSummary
}

export type PublicListingView = Common & { view: 'public'; photos: PublicPhoto[] }
export type OwnerListingView = Common & {
  view: 'owner'
  photos: OwnerPhoto[]
  rego: string | null
  rego_expiry: string | null
  status_reason: string | null
  review_flags: string[]
  version: number
}
export type ListingView = PublicListingView | OwnerListingView

/** Review flags as the seller reads them (docs/api-contracts.md → GET /api/listings/:id). */
const FLAG_TEXT: Record<string, string> = {
  image_review: 'Some photos are being checked by our team',
  duplicate_vin: 'Another listing uses this VIN, so our team is checking it',
  other_make_model: 'Our team is checking the make and model you typed in',
  reports_threshold: 'Buyers reported this listing, so our team is reviewing it',
}

const DETAIL_COLUMNS =
  'id,shop_id,make_other,model_other,year,odometer_km,price_cents,currency,condition,body_type,transmission,fuel,colour,vin,' +
  'rego,rego_expiry,description,state,city,status,status_reason,review_flags,live_at,sold_at,expires_at,version,' +
  'make:vehicle_makes(name),model:vehicle_models(name)'

type DetailRow = {
  id: string; shop_id: string; make_other: string | null; model_other: string | null; year: number | null
  odometer_km: number | null; price_cents: number | null; currency: string; condition: string | null
  body_type: string | null; transmission: string | null; fuel: string | null; colour: string | null; vin: string | null
  rego: string | null; rego_expiry: string | null; description: string; state: NgState | null; city: string | null
  status: ListingStatus; status_reason: string | null; review_flags: string[]; live_at: string | null
  sold_at: string | null; expires_at: string | null; version: number
  make: { name: string } | null; model: { name: string } | null
}

type PhotoRow = { id: string; position: number; status: string; status_reason: string | null; public_paths: Partial<PhotoUrls> | null }

const notFound = (): Result<never, AppError> => err({ code: 'NOT_FOUND', message: 'Listing not found' })

function publicUrls(db: SupabaseClient, paths: Partial<PhotoUrls> | null): PhotoUrls | null {
  if (!paths?.sm || !paths.md || !paths.lg) return null
  const url = (p: string) => db.storage.from(PUBLIC_BUCKET).getPublicUrl(p).data.publicUrl
  return { sm: url(paths.sm), md: url(paths.md), lg: url(paths.lg) }
}

async function shopSummary(db: SupabaseClient, shopId: string): Promise<ShopSummary | null> {
  const { data } = await db.from('public_shops').select('id,name,slug,city,state,verified').eq('id', shopId).maybeSingle()
  if (data) return data as ShopSummary
  // Owners and admins can still see an unapproved shop through the shops table.
  const { data: own } = await db.from('shops').select('id,name,slug,city,state').eq('id', shopId).maybeSingle()
  return own ? { ...(own as Omit<ShopSummary, 'verified'>), verified: false } : null
}

async function canManage(db: SupabaseClient, shopId: string): Promise<boolean> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return false
  const [{ data: owns }, { data: admin }] = await Promise.all([
    db.rpc('owns_shop', { p_shop_id: shopId }),
    db.rpc('is_admin'),
  ])
  return owns === true || admin === true
}

/**
 * GET /api/listings/:id. The owner and admins get the owner view (any status, every photo with its
 * status). Everyone else gets the public view of a live or recently sold listing, or NOT_FOUND.
 */
export async function getListingForViewer(db: SupabaseClient, id: string): Promise<Result<ListingView, AppError>> {
  const { data, error } = await db.from('listings').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return notFound()
  const row = data as unknown as DetailRow

  const [manage, shop, photosRes] = await Promise.all([
    canManage(db, row.shop_id),
    shopSummary(db, row.shop_id),
    db.from('listing_images').select('id,position,status,status_reason,public_paths')
      .eq('listing_id', id).is('deleted_at', null).order('position'),
  ])
  if (photosRes.error) return err({ code: 'INTERNAL_ERROR', message: photosRes.error.message })
  if (!shop) return notFound()
  const photos = (photosRes.data ?? []) as PhotoRow[]

  const make = row.make_other ?? row.make?.name ?? null
  const model = row.model_other ?? row.model?.name ?? null
  const title = [row.year, make, model].filter(Boolean).join(' ') || 'Untitled car'
  const common: Common = {
    id: row.id, title, make, model, year: row.year, odometer_km: row.odometer_km, price_cents: row.price_cents,
    currency: row.currency, condition: row.condition, body_type: row.body_type, transmission: row.transmission,
    fuel: row.fuel, colour: row.colour, vin: row.vin, description: row.description, state: row.state, city: row.city,
    status: row.status, live_at: row.live_at, sold_at: row.sold_at, expires_at: row.expires_at, shop,
  }

  if (manage) {
    return ok({
      ...common, view: 'owner', rego: row.rego, rego_expiry: row.rego_expiry, status_reason: row.status_reason,
      review_flags: row.review_flags.map((f) => FLAG_TEXT[f] ?? f), version: row.version,
      photos: photos.map((p) => ({
        id: p.id, position: p.position, status: p.status, status_reason: p.status_reason,
        urls: p.status === 'passed' ? publicUrls(db, p.public_paths) : null,
      })),
    })
  }

  if (row.status !== 'live' && row.status !== 'sold') return notFound()
  return ok({
    ...common, view: 'public',
    photos: photos.flatMap((p) => {
      const urls = p.status === 'passed' ? publicUrls(db, p.public_paths) : null
      return urls ? [{ id: p.id, position: p.position, urls }] : []
    }),
  })
}

// ── Search (docs/api-contracts.md → GET /api/listings) ─────────────────────────────────────────

export type ListingCard = {
  id: string
  title: string
  price_cents: number | null
  currency: string
  year: number | null
  odometer_km: number | null
  condition: string | null
  body_type: string | null
  transmission: string | null
  fuel: string | null
  city: string | null
  state: NgState | null
  thumbnail_url: string | null
  shop: { name: string; slug: string; verified: boolean }
  live_at: string | null
}

type SearchRow = Omit<ListingCard, 'thumbnail_url'> & { thumbnail_path: string | null }

/** Live listings of approved shops, filtered and sorted; one database call (no N+1). */
export async function searchListings(
  db: SupabaseClient, query: SearchQuery, opts: { shopId?: string } = {},
): Promise<Result<Page<ListingCard>, AppError>> {
  const { data, error } = await db.rpc('search_listings', {
    p_q: query.q ?? null, p_make_id: query.make_id ?? null, p_model_id: query.model_id ?? null,
    p_price_min: query.price_min ?? null, p_price_max: query.price_max ?? null,
    p_year_min: query.year_min ?? null, p_year_max: query.year_max ?? null, p_km_max: query.km_max ?? null,
    p_condition: query.condition ?? null, p_body_type: query.body_type ?? null, p_transmission: query.transmission ?? null,
    p_fuel: query.fuel ?? null, p_state: query.state ?? null, p_city: query.city ?? null, p_shop_id: opts.shopId ?? null,
    p_sort: query.sort, p_page: query.page, p_page_size: SEARCH_PAGE_SIZE,
  })
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const result = data as { total: number; items: SearchRow[] }
  return ok({
    items: result.items.map(({ thumbnail_path, ...card }) => ({
      ...card,
      thumbnail_url: thumbnail_path ? db.storage.from(PUBLIC_BUCKET).getPublicUrl(thumbnail_path).data.publicUrl : null,
    })),
    page: { number: query.page, size: SEARCH_PAGE_SIZE, total: result.total },
  })
}
