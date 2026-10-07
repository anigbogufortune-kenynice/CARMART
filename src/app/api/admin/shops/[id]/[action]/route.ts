import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { decideShop, setSuspension } from '@/services/moderation.service'
import { err } from '@/types/result'

/** POST /api/admin/shops/:id/(approve|reject|suspend|unsuspend). */
export const POST = withRoute(
  { auth: 'admin', body: z.object({ reason: z.string().max(500).optional() }).strict() },
  async ({ db, params, body }) => {
    if (!z.string().uuid().safeParse(params.id).success) return err({ code: 'NOT_FOUND', message: 'Shop not found' })
    if (params.action === 'approve') return decideShop(db, params.id, 'approve')
    if (params.action === 'reject') return decideShop(db, params.id, 'reject', body.reason)
    if (params.action === 'suspend' || params.action === 'unsuspend') {
      return setSuspension(db, 'shop', params.id, params.action === 'suspend', body.reason ?? '')
    }
    return err({ code: 'NOT_FOUND', message: 'Unknown action' })
  },
)
