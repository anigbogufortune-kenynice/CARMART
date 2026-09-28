import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { getPhotoStatus } from '@/services/image-upload.service'
import { err } from '@/types/result'

/** GET /api/listings/:id/images/status: each photo's status, reason and thumbnail (owner only). */
export const GET = withRoute({ auth: 'user' }, async ({ db, params }) =>
  isUuid(params.id) ? getPhotoStatus(db, params.id) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
