import { z } from 'zod'

/** Job-runner environment (docs/env.md). Imported only inside src/server/jobs/** (ADR-006). */
const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    INTERNAL_JOB_SECRET: z.string().min(32),
    CAR_CHECK_PROVIDER: z.enum(['claude', 'fake']),
    AI_CHECK_PROVIDER: z.enum(['sightengine', 'fake']),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_CAR_CHECK_MODEL: z.string().default('claude-haiku-4-5-20251001'),
    SIGHTENGINE_API_USER: z.string().optional(),
    SIGHTENGINE_API_SECRET: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['resend', 'log']),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .refine((e) => e.CAR_CHECK_PROVIDER !== 'claude' || !!e.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY required')
  .refine(
    (e) => e.AI_CHECK_PROVIDER !== 'sightengine' || (!!e.SIGHTENGINE_API_USER && !!e.SIGHTENGINE_API_SECRET),
    'Sightengine credentials required',
  )
  .refine((e) => e.EMAIL_PROVIDER !== 'resend' || (!!e.RESEND_API_KEY && !!e.EMAIL_FROM), 'Resend credentials required')

export type JobsEnv = z.infer<typeof schema>

export function parseJobsEnv(source: Record<string, string | undefined>): JobsEnv {
  return schema.parse(source)
}

let cached: JobsEnv | null = null
export function jobsEnv(): JobsEnv {
  cached ??= parseJobsEnv(process.env)
  return cached
}
