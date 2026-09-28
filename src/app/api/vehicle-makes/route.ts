import { withRoute } from '@/lib/api/route-helpers'
import { listMakes } from '@/services/listing.service'

/** GET /api/vehicle-makes: active car makes, alphabetical. Public. */
export const GET = withRoute({ auth: 'public' }, async ({ db }) => listMakes(db))
