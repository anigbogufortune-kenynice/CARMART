import { withRoute } from '@/lib/api/route-helpers'
import { createShop } from '@/services/shop.service'
import { ShopCreateSchema } from '@/types/domain'

/** POST /api/shops: create the caller's (only) shop as a draft. */
export const POST = withRoute({ auth: 'user', body: ShopCreateSchema, successStatus: 201 }, async ({ db, body }) =>
  createShop(db, body),
)
