import { z } from 'zod'

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
