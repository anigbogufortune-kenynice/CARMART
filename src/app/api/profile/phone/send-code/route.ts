import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { sendPhoneCode } from '@/services/profile.service'

export const POST = withRoute({ auth: 'user', body: z.object({ phone: z.string().max(20) }).strict() }, async ({ db, body }) =>
  sendPhoneCode(db, body.phone),
)
