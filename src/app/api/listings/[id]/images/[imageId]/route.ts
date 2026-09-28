import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { deletePhoto } from '@/services/image-upload.service'
import { err } from '@/types/result'

/** DELETE /api/listings/:id/images/:imageId: soft-delete a photo. */
export const DELETE = withRoute({ auth: 'user', successStatus: 204 }, async ({ db, params }) =>
  isUuid(params.id) && isUuid(params.imageId)
    ? deletePhoto(db, params.id, params.imageId)
    : err({ code: 'NOT_FOUND', message: 'Photo not found' }),
)
