import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listMine } from '@/services/listing.service'
import { LISTING_STATUSES } from '@/types/domain'

const Query = z
  .object({ status: z.enum(LISTING_STATUSES).optional(), page: z.coerce.number().int().min(1).default(1) })
  .strict()

/** GET /api/shops/me/listings?status=&page=: the owner's listings, 24 per page. */
export const GET = withRoute({ auth: 'user', query: Query, paginated: true }, async ({ db, query }) => listMine(db, query))
