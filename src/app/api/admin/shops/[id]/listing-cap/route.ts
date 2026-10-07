import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { setListingCap } from '@/services/moderation.service'
import { err } from '@/types/result'

const Body = z.object({ listing_cap: z.number().int().min(1).max(1000), reason: z.string().max(500) }).strict()

/** PATCH /api/admin/shops/:id/listing-cap { listing_cap, reason }. */
export const PATCH = withRoute({ auth: 'admin', body: Body }, async ({ db, params, body }) =>
  z.string().uuid().safeParse(params.id).success
    ? setListingCap(db, params.id, body.listing_cap, body.reason)
    : err({ code: 'NOT_FOUND', message: 'Shop not found' }),
)
