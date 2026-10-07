import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { listMessages, sendMessage } from '@/services/messaging.service'
import { err } from '@/types/result'

const Query = z.object({ before: z.string().datetime({ offset: true }).optional() }).strict()
/** Text only: any extra key (e.g. an attachment) is rejected with 422. */
const Body = z.object({ body: z.string().trim().min(1).max(2000) }).strict()
const notFound = () => err({ code: 'NOT_FOUND', message: 'Conversation not found' })

/** GET /api/conversations/:id/messages?before=: 50 messages, oldest first; marks incoming ones read. */
export const GET = withRoute({ auth: 'user', query: Query }, async ({ db, params, query }) =>
  isUuid(params.id) ? listMessages(db, params.id, { before: query.before }) : notFound(),
)

/** POST /api/conversations/:id/messages → 201. */
export const POST = withRoute({ auth: 'user', body: Body, successStatus: 201 }, async ({ db, params, body }) =>
  isUuid(params.id) ? sendMessage(db, params.id, body.body) : notFound(),
)
