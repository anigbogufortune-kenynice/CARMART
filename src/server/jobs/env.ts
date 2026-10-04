import { z } from 'zod'

/**
 * Job-runner environment (docs/env.md). Imported only inside src/server/jobs/** (ADR-006).
 * Vendor settings are checked only for the job that needs them, so a missing email setting
 * can't stop photo checks, and missing photo-check keys can't stop emails.
 */
const schema = z.object({
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

export type JobsEnv = z.infer<typeof schema>
export type JobNeed = 'images' | 'email'

function requireFor(env: JobsEnv, needs: readonly JobNeed[]): void {
  if (needs.includes('images')) {
    if (env.CAR_CHECK_PROVIDER === 'claude' && !env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY required')
    if (env.AI_CHECK_PROVIDER === 'sightengine' && !(env.SIGHTENGINE_API_USER && env.SIGHTENGINE_API_SECRET)) {
      throw new Error('Sightengine credentials required')
    }
  }
  if (needs.includes('email') && env.EMAIL_PROVIDER === 'resend' && !(env.RESEND_API_KEY && env.EMAIL_FROM)) {
    throw new Error('Resend credentials required')
  }
}

export function parseJobsEnv(source: Record<string, string | undefined>, needs: readonly JobNeed[] = ['images', 'email']): JobsEnv {
  const env = schema.parse(source)
  requireFor(env, needs)
  return env
}

let cached: JobsEnv | null = null
/** The validated job environment; `needs` adds the vendor checks for the calling job. */
export function jobsEnv(needs: readonly JobNeed[] = []): JobsEnv {
  cached ??= schema.parse(process.env)
  requireFor(cached, needs)
  return cached
}
