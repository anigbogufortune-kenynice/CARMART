import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { reorderPhotos } from '@/services/image-upload.service'
import { PhotoOrderSchema } from '@/types/domain'
import { err } from '@/types/result'

/** PUT /api/listings/:id/images/order: set the photos' display order. */
export const PUT = withRoute({ auth: 'user', body: PhotoOrderSchema }, async ({ db, params, body }) =>
  isUuid(params.id) ? reorderPhotos(db, params.id, body.image_ids) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
