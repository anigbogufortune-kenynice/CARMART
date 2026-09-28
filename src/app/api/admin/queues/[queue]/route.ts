import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listQueue, type QueueName } from '@/services/moderation.service'

/** GET /api/admin/queues/:queue?page=N: admin review queues, oldest first. */
export const GET = withRoute(
  { auth: 'admin', query: z.object({ page: z.coerce.number().int().min(1).default(1) }).strict() },
  async ({ db, params, query }) => listQueue(db, params.queue as QueueName, query.page),
)
