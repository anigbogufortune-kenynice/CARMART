import { z } from 'zod'
import { VIN_PATTERN, normaliseVin } from '@/lib/vin'

/** Shared domain enums and Zod building blocks (docs/api-contracts.md). */
/** Nigeria's 36 states and the Federal Capital Territory (ADR-015). */
export const NG_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const
export type NgState = (typeof NG_STATES)[number]
export const StateSchema = z.enum(NG_STATES)
/** Display name: "FCT" reads as "FCT (Abuja)". */
export const stateLabel = (s: NgState) => (s === 'FCT' ? 'FCT (Abuja)' : s)
export const CitySchema = z.string().trim().min(2, 'Enter your city or area').max(60)
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
    city: CitySchema,
    state: StateSchema,
  })
  .strict()
export type ShopCreateInput = z.infer<typeof ShopCreateSchema>

export type ShopStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended'

export const ShopUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
    slug: SlugSchema,
    description: z.string().trim().max(1000).nullable(),
    city: CitySchema,
    state: StateSchema,
    show_phone: z.boolean(),
  })
  .partial()
  .strict()
export type ShopUpdateInput = z.infer<typeof ShopUpdateSchema>

/** E.164 Nigerian mobile: +234 then 70/71/80/81/90/91 and 8 digits (docs/api-contracts.md). */
export const NgMobileSchema = z.string().regex(/^\+234[789][01]\d{8}$/, 'INVALID_NG_MOBILE')

/** Accepts common local formats (0803 123 4567, +234 803…, 234803…, 803…) → E.164, or null. */
export function normaliseNgMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  let national: string | null = null
  if (/^0[789][01]\d{8}$/.test(digits)) national = digits.slice(1)
  else if (/^\+234[789][01]\d{8}$/.test(digits)) national = digits.slice(4)
  else if (/^234[789][01]\d{8}$/.test(digits)) national = digits.slice(3)
  else if (/^[789][01]\d{8}$/.test(digits)) national = digits
  return national ? `+234${national}` : null
}

// ── Listings (docs/api-contracts.md → ListingInput; docs/systems/listing-lifecycle.md BR-L2/L3/L9) ──

export const BODY_TYPES = ['sedan', 'hatchback', 'suv', 'wagon', 'coupe', 'convertible', 'pickup', 'people_mover'] as const
export const TRANSMISSIONS = ['automatic', 'manual'] as const
export const FUELS = ['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'cng', 'lpg'] as const
export const CONDITIONS = ['brand_new', 'foreign_used', 'nigerian_used'] as const
export const LISTING_STATUSES = ['draft', 'checking', 'in_review', 'rejected', 'live', 'sold', 'expired', 'removed'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const BodyTypeSchema = z.enum(BODY_TYPES)
export const TransmissionSchema = z.enum(TRANSMISSIONS)
export const FuelSchema = z.enum(FUELS)
export const ConditionSchema = z.enum(CONDITIONS)
/** Normalised to uppercase; the message is the API error code (422 INVALID_VIN). */
export const VinSchema = z.string().transform(normaliseVin).pipe(z.string().regex(VIN_PATTERN, 'INVALID_VIN'))

const listingFields = {
  make_id: z.string().uuid().nullable(),
  make_other: z.string().trim().min(2).max(40).nullable(),
  model_id: z.string().uuid().nullable(),
  model_other: z.string().trim().min(1).max(40).nullable(),
  year: z.number().int().min(1900).refine((y) => y <= new Date().getFullYear() + 1, 'Year can’t be more than one year ahead'),
  odometer_km: z.number().int().min(0).max(2_000_000),
  price_cents: z.number().int().min(100_000, 'Enter a price of at least ₦1,000').max(1_000_000_000_000),
  condition: ConditionSchema,
  body_type: BodyTypeSchema,
  transmission: TransmissionSchema,
  fuel: FuelSchema,
  colour: z.string().trim().min(2).max(30),
  vin: VinSchema,
  rego: z.string().transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{1,10}$/, 'Plate number is up to 10 letters and numbers')).nullable(),
  rego_expiry: z.string().date().nullable(),
  description: z.string().trim().max(5000),
  state: StateSchema,
  city: CitySchema,
}

type PairCheck = { make_id?: string | null; make_other?: string | null; model_id?: string | null; model_other?: string | null }

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

/** Display labels for listing enums. */
export const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
  sedan: 'Sedan', hatchback: 'Hatchback', suv: 'SUV', wagon: 'Wagon', coupe: 'Coupe',
  convertible: 'Convertible', pickup: 'Pickup', people_mover: 'Minivan / bus',
}
export const TRANSMISSION_LABELS: Record<(typeof TRANSMISSIONS)[number], string> = { automatic: 'Automatic', manual: 'Manual' }
export const FUEL_LABELS: Record<(typeof FUELS)[number], string> = {
  petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid', plug_in_hybrid: 'Plug-in hybrid', electric: 'Electric', cng: 'CNG', lpg: 'LPG',
}
export const CONDITION_LABELS: Record<(typeof CONDITIONS)[number], string> = {
  brand_new: 'Brand new', foreign_used: 'Foreign used (Tokunbo)', nigerian_used: 'Nigerian used',
}
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draft', checking: 'Checking photos', in_review: 'In review', rejected: 'Needs changes',
  live: 'Live', sold: 'Sold', expired: 'Expired', removed: 'Removed',
}

// ── Listing photos (docs/api-contracts.md → Listing photos; ADR-007) ──
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_PHOTO_BYTES = 10_485_760
export const UploadRequestSchema = z
  .object({ mime_type: z.enum(PHOTO_MIME_TYPES), bytes: z.number().int().min(1).max(MAX_PHOTO_BYTES) })
  .strict()
export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type ImageStatus = 'uploaded' | 'checking' | 'passed' | 'rejected' | 'in_review'
export const PhotoOrderSchema = z.object({ image_ids: z.array(z.string().uuid()).min(1).max(20) }).strict()
