import { z } from 'zod'
import { isPostcodeInState } from '@/lib/au-postcode'
import { VIN_PATTERN, normaliseVin } from '@/lib/vin'

/** Shared domain enums and Zod building blocks (docs/api-contracts.md). */
export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const
export const AuStateSchema = z.enum(AU_STATES)
export const PostcodeSchema = z.string().regex(/^\d{4}$/, 'Enter a 4-digit postcode')
export const SlugSchema = z
  .string()
  .min(3, 'Use at least 3 characters')
  .max(50, 'Use 50 characters or fewer')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')

export const ShopCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
    slug: SlugSchema,
    description: z.string().trim().max(1000).optional(),
    suburb: z.string().trim().min(2, 'Enter your suburb').max(60),
    state: AuStateSchema,
    postcode: PostcodeSchema,
  })
  .strict()
export type ShopCreateInput = z.infer<typeof ShopCreateSchema>

export type ShopStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended'

export const ShopUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
    slug: SlugSchema,
    description: z.string().trim().max(1000).nullable(),
    suburb: z.string().trim().min(2, 'Enter your suburb').max(60),
    state: AuStateSchema,
    postcode: PostcodeSchema,
    show_phone: z.boolean(),
  })
  .partial()
  .strict()
export type ShopUpdateInput = z.infer<typeof ShopUpdateSchema>

/** E.164 Australian mobile: +614XXXXXXXX (docs/api-contracts.md). */
export const AuMobileSchema = z.string().regex(/^\+614\d{8}$/, 'INVALID_AU_MOBILE')

/** Accepts common local formats (0412 345 678, +61 412…, 61412…) → E.164, or null. */
export function normaliseAuMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  let national: string | null = null
  if (/^04\d{8}$/.test(digits)) national = digits.slice(1)
  else if (/^\+614\d{8}$/.test(digits)) national = digits.slice(3)
  else if (/^614\d{8}$/.test(digits)) national = digits.slice(2)
  return national ? `+61${national}` : null
}

// ── Listings (docs/api-contracts.md → ListingInput; docs/systems/listing-lifecycle.md BR-L2/L3/L9) ──

export const BODY_TYPES = ['sedan', 'hatchback', 'suv', 'wagon', 'coupe', 'convertible', 'ute', 'people_mover'] as const
export const TRANSMISSIONS = ['automatic', 'manual'] as const
export const FUELS = ['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'lpg'] as const
export const LISTING_STATUSES = ['draft', 'checking', 'in_review', 'rejected', 'live', 'sold', 'expired', 'removed'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const BodyTypeSchema = z.enum(BODY_TYPES)
export const TransmissionSchema = z.enum(TRANSMISSIONS)
export const FuelSchema = z.enum(FUELS)
/** Normalised to uppercase; the message is the API error code (422 INVALID_VIN). */
export const VinSchema = z.string().transform(normaliseVin).pipe(z.string().regex(VIN_PATTERN, 'INVALID_VIN'))

const listingFields = {
  make_id: z.string().uuid().nullable(),
  make_other: z.string().trim().min(2).max(40).nullable(),
  model_id: z.string().uuid().nullable(),
  model_other: z.string().trim().min(1).max(40).nullable(),
  year: z.number().int().min(1900).refine((y) => y <= new Date().getFullYear() + 1, 'Year can’t be more than one year ahead'),
  odometer_km: z.number().int().min(0).max(2_000_000),
  price_cents: z.number().int().min(100).max(1_000_000_000),
  body_type: BodyTypeSchema,
  transmission: TransmissionSchema,
  fuel: FuelSchema,
  colour: z.string().trim().min(2).max(30),
  vin: VinSchema,
  rego: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,9}$/, 'Rego is up to 9 letters and numbers').nullable(),
  rego_expiry: z.string().date().nullable(),
  description: z.string().trim().max(5000),
  state: AuStateSchema,
  suburb: z.string().trim().min(2).max(60),
  postcode: PostcodeSchema,
}

type PairCheck = { make_id?: string | null; make_other?: string | null; model_id?: string | null; model_other?: string | null; state?: string; postcode?: string }

/** Cross-field rules. `complete` = submit-time (exactly one of each pair); drafts only forbid both. */
function crossChecks(complete: boolean) {
  return (v: PairCheck, ctx: z.RefinementCtx) => {
    const both = (a: unknown, b: unknown) => a != null && b != null
    const neither = (a: unknown, b: unknown) => a == null && b == null
    if (both(v.make_id, v.make_other) || (complete && neither(v.make_id, v.make_other))) {
      ctx.addIssue({ code: 'custom', path: ['make_id'], message: 'MAKE_REQUIRED' })
    }
    if (both(v.model_id, v.model_other) || (complete && neither(v.model_id, v.model_other))) {
      ctx.addIssue({ code: 'custom', path: ['model_id'], message: 'MODEL_REQUIRED' })
    }
    if (v.state && v.postcode && /^\d{4}$/.test(v.postcode) && !isPostcodeInState(v.postcode, v.state as (typeof AU_STATES)[number])) {
      ctx.addIssue({ code: 'custom', path: ['postcode'], message: 'POSTCODE_STATE_MISMATCH' })
    }
  }
}

/** A complete listing, as required on submit. */
export const ListingInputSchema = z.object(listingFields).strict().superRefine(crossChecks(true))
export type ListingInput = z.infer<typeof ListingInputSchema>

/** Draft create/update body: any subset of fields, each validated when present. */
export const ListingDraftSchema = z.object(listingFields).partial().strict().superRefine(crossChecks(false))
export type ListingDraftInput = z.infer<typeof ListingDraftSchema>

/** PATCH /api/listings/:id body: draft fields plus the optimistic-lock version (BR-L10). */
export const ListingPatchSchema = z
  .object(listingFields)
  .partial()
  .extend({ version: z.number().int().min(1) })
  .strict()
  .superRefine(crossChecks(false))
export type ListingPatchInput = z.infer<typeof ListingPatchSchema>
