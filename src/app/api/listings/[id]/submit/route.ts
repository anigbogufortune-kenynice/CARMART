import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { submitListing } from '@/services/listing-lifecycle.service'
import { err } from '@/types/result'

const Body = z.object({ version: z.number().int().min(1) }).strict()

/** POST /api/listings/:id/submit: submit for checks; goes live automatically when everything passes. */
export const POST = withRoute({ auth: 'user', body: Body }, async ({ db, params, body }) =>
  isUuid(params.id) ? submitListing(db, params.id, body.version) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
