import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { unsaveListing } from '@/services/saved.service'
import { err } from '@/types/result'

/** DELETE /api/saved-listings/:listingId → 204. */
export const DELETE = withRoute({ auth: 'user', successStatus: 204 }, async ({ db, params }) =>
  isUuid(params.listingId) ? unsaveListing(db, params.listingId) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
