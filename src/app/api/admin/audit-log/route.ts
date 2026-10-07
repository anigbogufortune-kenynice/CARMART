import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listAuditLog } from '@/services/moderation.service'

const Query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  target_type: z.enum(['shop', 'listing', 'image', 'user', 'report', 'settings']).optional(),
  target_id: z.string().trim().min(1).max(100).optional(),
}).strict()

/** GET /api/admin/audit-log?page=&target_type=&target_id=: newest first, 50 per page. */
export const GET = withRoute({ auth: 'admin', query: Query, paginated: true }, async ({ db, query }) => listAuditLog(db, query))
