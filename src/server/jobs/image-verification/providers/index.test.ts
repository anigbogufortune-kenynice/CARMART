// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseJobsEnv } from '../../env'
import { ClaudeCarCheckProvider } from './claude-car-check.provider'
import { FakeAiCheckProvider, FakeCarCheckProvider } from './fake.provider'
import { getProviders } from './index'
import { SightengineAiCheckProvider } from './sightengine-ai-check.provider'

const base = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  SUPABASE_SERVICE_ROLE_KEY: 'service', INTERNAL_JOB_SECRET: 'x'.repeat(32), EMAIL_PROVIDER: 'log',
}

describe('getProviders', () => {
  it('returns the fake providers', () => {
    const p = getProviders(parseJobsEnv({ ...base, CAR_CHECK_PROVIDER: 'fake', AI_CHECK_PROVIDER: 'fake' }))
    expect(p.car).toBeInstanceOf(FakeCarCheckProvider)
    expect(p.ai).toBeInstanceOf(FakeAiCheckProvider)
  })

  it('returns the real providers when configured', () => {
    const p = getProviders(parseJobsEnv({
      ...base, CAR_CHECK_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k',
      AI_CHECK_PROVIDER: 'sightengine', SIGHTENGINE_API_USER: 'u', SIGHTENGINE_API_SECRET: 's',
    }))
    expect(p.car).toBeInstanceOf(ClaudeCarCheckProvider)
    expect(p.ai).toBeInstanceOf(SightengineAiCheckProvider)
  })

  it('claude without ANTHROPIC_API_KEY fails at env parse', () => {
    expect(() => parseJobsEnv({ ...base, CAR_CHECK_PROVIDER: 'claude', AI_CHECK_PROVIDER: 'fake' })).toThrow('ANTHROPIC_API_KEY required')
  })
})
