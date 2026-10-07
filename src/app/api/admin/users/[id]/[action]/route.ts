import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { setSuspension } from '@/services/moderation.service'
import { err } from '@/types/result'

/** POST /api/admin/users/:id/(suspend|unsuspend) { reason } (5–500, else 422 REASON_REQUIRED). */
export const POST = withRoute(
  { auth: 'admin', body: z.object({ reason: z.string().max(500).optional() }).strict() },
  async ({ db, params, body }) => {
    if (!z.string().uuid().safeParse(params.id).success) return err({ code: 'NOT_FOUND', message: 'User not found' })
    if (params.action !== 'suspend' && params.action !== 'unsuspend') return err({ code: 'NOT_FOUND', message: 'Unknown action' })
    return setSuspension(db, 'user', params.id, params.action === 'suspend', body.reason ?? '')
  },
)
