import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listSaved, saveListing } from '@/services/saved.service'

const Query = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict()
const Body = z.object({ listing_id: z.string().uuid() }).strict()

/** GET /api/saved-listings: the caller's saved cars (unavailable ones flagged). */
export const GET = withRoute({ auth: 'user', query: Query, paginated: true }, async ({ db, query }) => listSaved(db, query.page))

/** POST /api/saved-listings: 201 when newly saved, 200 when it already was; 404 if not public. */
export const POST = withRoute(
  { auth: 'user', body: Body, statusFrom: (v) => ((v as { created: boolean }).created ? 201 : 200) },
  async ({ db, body }) => saveListing(db, body.listing_id),
)
