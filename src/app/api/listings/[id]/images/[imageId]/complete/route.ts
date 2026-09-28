import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { completeUpload } from '@/services/image-upload.service'
import { err } from '@/types/result'

/** POST /api/listings/:id/images/:imageId/complete: confirm the upload and start the checks. */
export const POST = withRoute({ auth: 'user', successStatus: 202 }, async ({ db, params }) =>
  isUuid(params.id) && isUuid(params.imageId)
    ? completeUpload(db, params.id, params.imageId)
    : err({ code: 'NOT_FOUND', message: 'Photo not found' }),
)
