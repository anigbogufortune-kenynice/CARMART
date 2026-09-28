import { withRoute } from '@/lib/api/route-helpers'
import { getMyShop, updateMyShop } from '@/services/shop.service'
import { ShopUpdateSchema } from '@/types/domain'

export const GET = withRoute({ auth: 'user' }, async ({ db }) => getMyShop(db))

export const PATCH = withRoute({ auth: 'user', body: ShopUpdateSchema }, async ({ db, body }) => updateMyShop(db, body))
