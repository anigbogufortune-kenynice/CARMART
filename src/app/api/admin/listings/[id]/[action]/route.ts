import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { decideListing } from '@/services/moderation.service'
import { err } from '@/types/result'

const Body = z.object({
  flag: z.enum(['duplicate_vin', 'other_make_model', 'reports_threshold', 'image_review']).optional(),
  reason: z.string().max(500).optional(),
}).strict()

/** POST /api/admin/listings/:id/(clear-flag|reject|remove). */
export const POST = withRoute({ auth: 'admin', body: Body }, async ({ db, params, body }) => {
  if (!z.string().uuid().safeParse(params.id).success) return err({ code: 'NOT_FOUND', message: 'Listing not found' })
  switch (params.action) {
    case 'clear-flag':
      return body.flag
        ? decideListing(db, params.id, { action: 'clear-flag', flag: body.flag, reason: body.reason })
        : err({ code: 'VALIDATION_ERROR', message: 'Choose the flag to clear' })
    case 'reject':
      return decideListing(db, params.id, { action: 'reject', reason: body.reason ?? '' })
    case 'remove':
      return decideListing(db, params.id, { action: 'remove', reason: body.reason ?? '' })
    default:
      return err({ code: 'NOT_FOUND', message: 'Unknown action' })
  }
})
