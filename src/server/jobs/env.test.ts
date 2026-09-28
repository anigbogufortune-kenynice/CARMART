import { describe, expect, it } from 'vitest'
import { parseJobsEnv } from './env'

const base = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  SUPABASE_SERVICE_ROLE_KEY: 'k', INTERNAL_JOB_SECRET: 'x'.repeat(32),
  CAR_CHECK_PROVIDER: 'fake', AI_CHECK_PROVIDER: 'fake', EMAIL_PROVIDER: 'log',
}

describe('jobs env', () => {
  it('accepts the fake/log configuration', () => {
    expect(parseJobsEnv(base).ANTHROPIC_CAR_CHECK_MODEL).toBe('claude-haiku-4-5-20251001')
  })
  it('requires ANTHROPIC_API_KEY for the Claude car check', () => {
    expect(() => parseJobsEnv({ ...base, CAR_CHECK_PROVIDER: 'claude' })).toThrow('ANTHROPIC_API_KEY required')
  })
  it('requires Resend credentials for real email', () => {
    expect(() => parseJobsEnv({ ...base, EMAIL_PROVIDER: 'resend' })).toThrow('Resend credentials required')
  })
  it('requires a 32+ character internal secret', () => {
    expect(() => parseJobsEnv({ ...base, INTERNAL_JOB_SECRET: 'short' })).toThrow()
  })
})
