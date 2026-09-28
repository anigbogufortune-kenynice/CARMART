import { withRoute } from '@/lib/api/route-helpers'
import { submitMyShop } from '@/services/shop.service'

/** POST /api/shops/me/submit: draft | rejected → pending_approval. */
export const POST = withRoute({ auth: 'user' }, async ({ db }) => submitMyShop(db))
