import { withRoute } from '@/lib/api/route-helpers'
import { isUuid } from '@/lib/uuid'
import { requestUpload } from '@/services/image-upload.service'
import { UploadRequestSchema } from '@/types/domain'
import { err } from '@/types/result'

/** POST /api/listings/:id/images: request a signed upload URL for a new photo. */
export const POST = withRoute({ auth: 'user', body: UploadRequestSchema, successStatus: 201 }, async ({ db, params, body }) =>
  isUuid(params.id) ? requestUpload(db, params.id, body) : err({ code: 'NOT_FOUND', message: 'Listing not found' }),
)
