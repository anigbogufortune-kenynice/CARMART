import { withRoute } from '@/lib/api/route-helpers'
import { createDraft } from '@/services/listing.service'
import { searchListings } from '@/services/search.service'
import { ListingDraftSchema, SearchQuerySchema } from '@/types/domain'

/** GET /api/listings: public search of live cars (filters, sort, 24 per page). */
export const GET = withRoute({ auth: 'public', query: SearchQuerySchema, paginated: true }, async ({ db, query }) =>
  searchListings(db, query),
)

/** POST /api/listings: create a draft for the caller's shop (partial input allowed). */
export const POST = withRoute({ auth: 'user', body: ListingDraftSchema, successStatus: 201 }, async ({ db, body }) =>
  createDraft(db, body),
)
