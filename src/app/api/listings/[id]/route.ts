import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { deleteDraft, updateDraft } from '@/services/listing.service'
import { getListingForViewer } from '@/services/search.service'
import { ListingPatchSchema } from '@/types/domain'
import { err } from '@/types/result'

const Id = z.string().uuid()
const notFound = () => err({ code: 'NOT_FOUND', message: 'Listing not found' })

/** GET /api/listings/:id: public view of a live/recently sold listing; owner/admin view of any. */
export const GET = withRoute({ auth: 'public' }, async ({ db, params }) =>
  Id.safeParse(params.id).success ? getListingForViewer(db, params.id) : notFound(),
)

/** PATCH /api/listings/:id: edit a draft (rejected/expired too); `version` required. */
export const PATCH = withRoute({ auth: 'user', body: ListingPatchSchema }, async ({ db, params, body }) =>
  Id.safeParse(params.id).success ? updateDraft(db, params.id, body) : notFound(),
)

/** DELETE /api/listings/:id: drafts only. */
export const DELETE = withRoute({ auth: 'user', successStatus: 204 }, async ({ db, params }) =>
  Id.safeParse(params.id).success ? deleteDraft(db, params.id) : notFound(),
)
