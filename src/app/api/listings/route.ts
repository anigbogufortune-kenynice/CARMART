import { withRoute } from '@/lib/api/route-helpers'
import { createDraft } from '@/services/listing.service'
import { ListingDraftSchema } from '@/types/domain'

/** POST /api/listings: create a draft for the caller's shop (partial input allowed). */
export const POST = withRoute({ auth: 'user', body: ListingDraftSchema, successStatus: 201 }, async ({ db, body }) =>
  createDraft(db, body),
)
