import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { getMe, updateDisplayName } from '@/services/profile.service'

export const GET = withRoute({ auth: 'user' }, async ({ db }) => getMe(db))

export const PATCH = withRoute(
  { auth: 'user', body: z.object({ display_name: z.string().trim().min(1).max(60) }).strict() },
  async ({ db, body }) => {
    const updated = await updateDisplayName(db, body.display_name)
    return updated.ok ? getMe(db) : updated
  },
)
