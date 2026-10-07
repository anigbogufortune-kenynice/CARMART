import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { getShopPhone } from '@/services/messaging.service'
import { err } from '@/types/result'

/** GET /api/listings/:id/phone: the seller's number, signed-in buyers only, when the shop opted in. */
export const GET = withRoute({ auth: 'user' }, async ({ db, params }) =>
  isUuid(params.id) ? getShopPhone(db, params.id) : err({ code: 'PHONE_NOT_AVAILABLE', message: 'This seller’s phone number isn’t available' }),
)
