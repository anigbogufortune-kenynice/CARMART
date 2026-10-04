import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import {
  ListingDraftSchema, ListingPatchSchema, type ListingDraftInput, type ListingPatchInput, type ListingStatus, type NgState,
} from '@/types/domain'
import { err, ok, type AppError, type Page, type Result } from '@/types/result'

/**
 * Listing module: reference data now; drafts, submission and lifecycle arrive in later issues.
 * Reads go through the caller's client so RLS applies (docs/schema.md → vehicle_makes).
 */

export type NamedRef = { id: string; name: string }

/** Active car makes, alphabetical (GET /api/vehicle-makes). */
export async function listMakes(db: SupabaseClient): Promise<Result<NamedRef[], AppError>> {
  const { data, error } = await db.from('vehicle_makes').select('id,name').eq('active', true).order('name')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok(data ?? [])
}

/** Active models for an active make, alphabetical. Unknown or inactive make → NOT_FOUND. */
export async function listModels(db: SupabaseClient, makeId: string): Promise<Result<NamedRef[], AppError>> {
  const { data: make, error: makeError } = await db
    .from('vehicle_makes')
    .select('id')
    .eq('id', makeId)
    .eq('active', true)
    .maybeSingle()
  if (makeError) return err({ code: 'INTERNAL_ERROR', message: makeError.message })
  if (!make) return err({ code: 'NOT_FOUND', message: 'That make was not found' })
  const { data, error } = await db
    .from('vehicle_models')
    .select('id,name')
    .eq('make_id', makeId)
    .eq('active', true)
    .order('name')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok(data ?? [])
}

// ── Drafts (docs/api-contracts.md → POST/PATCH/DELETE /api/listings) ──────────────────────────

/** Owner view of a listing (docs/api-contracts.md → Listing). */
export type Listing = {
  id: string
  shop_id: string
  make_id: string | null
  model_id: string | null
  make_other: string | null
  model_other: string | null
  year: number | null
  odometer_km: number | null
  price_cents: number | null
  condition: string | null
  currency: string
  body_type: string | null
  transmission: string | null
  fuel: string | null
  colour: string | null
  vin: string | null
  rego: string | null
  rego_expiry: string | null
  description: string
  state: NgState | null
  city: string | null
  status: ListingStatus
  status_reason: string | null
  review_flags: string[]
  submitted_at: string | null
  live_at: string | null
  expires_at: string | null
  sold_at: string | null
  version: number
  created_at: string
  updated_at: string
}

const LISTING_COLUMNS =
  'id,shop_id,make_id,model_id,make_other,model_other,year,odometer_km,price_cents,currency,condition,body_type,transmission,fuel,' +
  'colour,vin,rego,rego_expiry,description,state,city,status,status_reason,review_flags,submitted_at,live_at,' +
  'expires_at,sold_at,version,created_at,updated_at'

/** Statuses whose fields the owner may freely edit; live listings follow the live-edit rules. */
const DRAFT_EDITABLE: ListingStatus[] = ['draft', 'rejected', 'expired']

function validationError(error: z.ZodError): AppError {
  const coded = error.issues.find((i) => /^[A-Z][A-Z0-9_]+$/.test(i.message))
  if (coded) return { code: coded.message, message: coded.message }
  const first = error.issues[0]
  return { code: 'VALIDATION_ERROR', message: `${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}` }
}

function mapWriteError(error: PostgrestError): AppError {
  const m = error.message
  if (m.includes('listings_vin_format')) return { code: 'INVALID_VIN', message: 'Enter a 17-character VIN (no I, O or Q)' }
  if (m.includes('listings_make_one_of')) return { code: 'MAKE_REQUIRED', message: 'Choose a make or enter one, not both' }
  if (m.includes('listings_model_one_of')) return { code: 'MODEL_REQUIRED', message: 'Choose a model or enter one, not both' }
  if (m.includes('listings_model_make_mismatch')) return { code: 'VALIDATION_ERROR', message: 'That model doesn’t belong to the selected make' }
  if (m.includes('listings_year_range')) return { code: 'VALIDATION_ERROR', message: 'Year can’t be more than one year ahead' }
  if (error.code === '23503') return { code: 'VALIDATION_ERROR', message: 'Unknown make or model' }
  if (error.code === '23514' || error.code === '22P02') return { code: 'VALIDATION_ERROR', message: m }
  if (error.code === '42501') return { code: 'FORBIDDEN', message: 'You cannot change this listing' }
  return { code: 'INTERNAL_ERROR', message: m }
}

type CallerShop = { id: string; status: string }

async function callerShop(db: SupabaseClient): Promise<Result<CallerShop, AppError>> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return err({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' })
  const { data, error } = await db.from('shops').select('id,status').eq('owner_id', auth.user.id).maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return err({ code: 'SHOP_NOT_FOUND', message: 'Create your shop first' })
  return ok(data)
}

async function ownListing(db: SupabaseClient, id: string): Promise<Result<{ shop: CallerShop; listing: Listing }, AppError>> {
  const shop = await callerShop(db)
  if (!shop.ok) return shop.error.code === 'SHOP_NOT_FOUND' ? err({ code: 'NOT_FOUND', message: 'Listing not found' }) : shop
  const { data, error } = await db.from('listings').select(LISTING_COLUMNS).eq('id', id).eq('shop_id', shop.value.id).maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return err({ code: 'NOT_FOUND', message: 'Listing not found' })
  return ok({ shop: shop.value, listing: data as unknown as Listing })
}

/** Create a draft for the caller's shop. Any subset of fields; each one present is validated. */
export async function createDraft(db: SupabaseClient, input: ListingDraftInput): Promise<Result<Listing, AppError>> {
  const parsed = ListingDraftSchema.safeParse(input)
  if (!parsed.success) return err(validationError(parsed.error))
  const shop = await callerShop(db)
  if (!shop.ok) return shop
  if (shop.value.status === 'suspended') return err({ code: 'FORBIDDEN', message: 'Your shop is suspended' })
  const { data, error } = await db
    .from('listings')
    .insert({ ...parsed.data, shop_id: shop.value.id })
    .select(LISTING_COLUMNS)
    .single()
  if (error) return err(mapWriteError(error))
  return ok(data as unknown as Listing)
}

const IDENTITY_FIELDS = ['vin', 'make_id', 'model_id', 'make_other', 'model_other', 'year'] as const
const conflict = (): Result<never, AppError> => err({ code: 'VERSION_CONFLICT', message: 'This listing changed. Reload and try again.' })

/**
 * PATCH /api/listings/:id (docs/systems/listing-lifecycle.md → edits). `version` must match (BR-L10).
 * - draft / rejected / expired: any field; the version doesn't change.
 * - live, minor fields only: stays live, version++ (the DB guard bumps it).
 * - live, VIN/make/model/year changed: `update_listing_identity` → checking, re-evaluated.
 * - checking / in_review / sold / removed: INVALID_STATE.
 */
export async function updateListing(db: SupabaseClient, id: string, patch: ListingPatchInput): Promise<Result<Listing, AppError>> {
  const parsed = ListingPatchSchema.safeParse(patch)
  if (!parsed.success) return err(validationError(parsed.error))
  const found = await ownListing(db, id)
  if (!found.ok) return found
  const { listing, shop } = found.value
  if (shop.status === 'suspended') return err({ code: 'FORBIDDEN', message: 'Your shop is suspended' })
  const live = listing.status === 'live'
  if (!live && !DRAFT_EDITABLE.includes(listing.status)) {
    return err({ code: 'INVALID_STATE', message: `A ${listing.status.replace('_', ' ')} listing can’t be edited right now` })
  }
  const { version, ...fields } = parsed.data
  if (version !== listing.version) return conflict()

  const merged = { ...listing, ...fields }
  if (merged.make_id && merged.make_other) return err({ code: 'MAKE_REQUIRED', message: 'Choose a make or enter one, not both' })
  if (merged.model_id && merged.model_other) return err({ code: 'MODEL_REQUIRED', message: 'Choose a model or enter one, not both' })

  const changed = Object.fromEntries(
    Object.entries(fields).filter(([k, v]) => listing[k as keyof Listing] !== v),
  ) as Partial<Listing>
  if (Object.keys(changed).length === 0) return ok(listing)

  if (live && IDENTITY_FIELDS.some((k) => k in changed)) {
    const { error } = await db.rpc('update_listing_identity', { p_listing_id: id, p_version: version, p_fields: changed })
    if (error) {
      if (error.message === 'VERSION_CONFLICT') return conflict()
      if (error.message === 'INVALID_STATE') return err({ code: 'INVALID_STATE', message: 'This listing can’t be edited right now' })
      return err(mapWriteError(error))
    }
    const reread = await ownListing(db, id)
    return reread.ok ? ok(reread.value.listing) : reread
  }

  const { data, error } = await db
    .from('listings')
    .update(changed)
    .eq('id', id)
    .eq('version', version)
    .select(LISTING_COLUMNS)
    .maybeSingle()
  if (error) {
    if (error.message === 'INVALID_STATE') return err({ code: 'INVALID_STATE', message: 'This listing can’t be edited right now' })
    return err(mapWriteError(error))
  }
  if (!data) return conflict()
  return ok(data as unknown as Listing)
}

/** Delete a draft. Any other status → INVALID_STATE. */
export async function deleteDraft(db: SupabaseClient, id: string): Promise<Result<null, AppError>> {
  const found = await ownListing(db, id)
  if (!found.ok) return found
  if (found.value.listing.status !== 'draft') return err({ code: 'INVALID_STATE', message: 'Only drafts can be deleted' })
  const { error, count } = await db.from('listings').delete({ count: 'exact' }).eq('id', id).eq('status', 'draft')
  if (error) return err(mapWriteError(error))
  if (!count) return err({ code: 'INVALID_STATE', message: 'Only drafts can be deleted' })
  return ok(null)
}

// ── Owner dashboard (GET /api/shops/me/listings) ─────────────────────────────────────────────

/** A listing plus its computed title (`{year} {make} {model}`, docs/systems/listing-lifecycle.md). */
export type OwnListing = Listing & { title: string }

const PAGE_SIZE = 24
const OWN_COLUMNS = `${LISTING_COLUMNS},make:vehicle_makes(name),model:vehicle_models(name)`

type OwnRow = Listing & { make: { name: string } | null; model: { name: string } | null }

function withTitle(row: OwnRow): OwnListing {
  const { make, model, ...listing } = row
  const parts = [listing.year, listing.make_other ?? make?.name, listing.model_other ?? model?.name].filter(Boolean)
  return { ...listing, title: parts.length ? parts.join(' ') : 'Untitled car' }
}

/** The caller's listings, most recently updated first, optionally filtered by status. */
export async function listMine(
  db: SupabaseClient,
  opts: { page: number; status?: ListingStatus },
): Promise<Result<Page<OwnListing>, AppError>> {
  const shop = await callerShop(db)
  if (!shop.ok) return shop
  const from = (opts.page - 1) * PAGE_SIZE
  let query = db.from('listings').select(OWN_COLUMNS, { count: 'exact' }).eq('shop_id', shop.value.id)
  if (opts.status) query = query.eq('status', opts.status)
  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok({
    items: ((data ?? []) as unknown as OwnRow[]).map(withTitle),
    page: { number: opts.page, size: PAGE_SIZE, total: count ?? 0 },
  })
}

/** One of the caller's listings (any status), with its title. */
export async function getMyListing(db: SupabaseClient, id: string): Promise<Result<OwnListing, AppError>> {
  const shop = await callerShop(db)
  if (!shop.ok) return shop.error.code === 'SHOP_NOT_FOUND' ? err({ code: 'NOT_FOUND', message: 'Listing not found' }) : shop
  const { data, error } = await db.from('listings').select(OWN_COLUMNS).eq('id', id).eq('shop_id', shop.value.id).maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return err({ code: 'NOT_FOUND', message: 'Listing not found' })
  return ok(withTitle(data as unknown as OwnRow))
}
