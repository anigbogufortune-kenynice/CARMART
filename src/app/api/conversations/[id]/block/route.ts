import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { blockConversation } from '@/services/messaging.service'
import { err } from '@/types/result'

/** POST /api/conversations/:id/block → 204 (participants only; others get 404). */
export const POST = withRoute({ auth: 'user', successStatus: 204 }, async ({ db, params }) =>
  isUuid(params.id) ? blockConversation(db, params.id) : err({ code: 'NOT_FOUND', message: 'Conversation not found' }),
)
