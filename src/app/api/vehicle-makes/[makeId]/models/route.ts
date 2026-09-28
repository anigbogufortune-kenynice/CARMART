import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { listModels } from '@/services/listing.service'
import { err } from '@/types/result'

const MakeId = z.string().uuid()

/** GET /api/vehicle-makes/:makeId/models: active models for a make, alphabetical. Public. */
export const GET = withRoute({ auth: 'public' }, async ({ db, params }) => {
  if (!MakeId.safeParse(params.makeId).success) return err({ code: 'VALIDATION_ERROR', message: 'Invalid make id' })
  return listModels(db, params.makeId)
})
