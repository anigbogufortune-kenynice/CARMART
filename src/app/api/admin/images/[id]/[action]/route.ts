import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { decideImage } from '@/services/moderation.service'
import { err } from '@/types/result'

/** POST /api/admin/images/:id/(approve|reject): a forced decision on a reviewed (or passed) photo. */
export const POST = withRoute(
  { auth: 'admin', body: z.object({ reason: z.string().max(500).optional() }).strict() },
  async ({ db, params, body }) => {
    if (!z.string().uuid().safeParse(params.id).success) return err({ code: 'NOT_FOUND', message: 'Photo not found' })
    if (params.action === 'approve') return decideImage(db, params.id, 'approve')
    if (params.action === 'reject') return decideImage(db, params.id, 'reject', body.reason)
    return err({ code: 'NOT_FOUND', message: 'Unknown action' })
  },
)
