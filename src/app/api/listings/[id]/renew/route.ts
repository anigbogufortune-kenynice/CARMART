import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { renewListing } from '@/services/listing-lifecycle.service'
import { err } from '@/types/result'

const Body = z.object({ version: z.number().int().min(1) }).strict()

/** POST /api/listings/:id/renew: expired → checking; live again for 60 days once photos pass. */
export const POST = withRoute({ auth: 'user', body: Body }, async ({ db, params, body }) =>
  isUuid(params.id) ? renewListing(db, params.id, body.version) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
