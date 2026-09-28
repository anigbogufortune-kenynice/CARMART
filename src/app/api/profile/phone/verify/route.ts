import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { verifyPhoneCode } from '@/services/profile.service'

export const POST = withRoute(
  { auth: 'user', body: z.object({ phone: z.string().max(20), code: z.string().max(6) }).strict() },
  async ({ db, body }) => verifyPhoneCode(db, body.phone, body.code),
)
