import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listConversations, startConversation } from '@/services/messaging.service'

const Query = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict()
const Body = z.object({ listing_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict()

/** GET /api/conversations: the caller's threads, newest first, with unread counts. */
export const GET = withRoute({ auth: 'user', query: Query, paginated: true }, async ({ db, query }) => listConversations(db, query.page))

/** POST /api/conversations: 201 for a new thread, 200 when the message joined an existing one. */
export const POST = withRoute(
  { auth: 'user', body: Body, statusFrom: (v) => ((v as { created: boolean }).created ? 201 : 200) },
  async ({ db, body }) => startConversation(db, body.listing_id, body.body),
)
