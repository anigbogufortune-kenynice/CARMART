import { z } from 'zod'
import { withRoute } from '@/lib/api/route-helpers'
import { getSettings, SETTING_DEFINITIONS, updateSetting } from '@/services/settings.service'

const KEYS = SETTING_DEFINITIONS.map((d) => d.key) as [string, ...string[]]
const Body = z.object({ key: z.enum(KEYS), value: z.number() }).strict()

/** GET /api/admin/settings: every setting. */
export const GET = withRoute({ auth: 'admin' }, async ({ db }) => getSettings(db))

/** PATCH /api/admin/settings { key, value }: validated per key and against related keys; audited. */
export const PATCH = withRoute({ auth: 'admin', body: Body }, async ({ db, body }) => updateSetting(db, body.key, body.value))
