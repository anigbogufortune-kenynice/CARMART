import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('env', () => {
  it('throws a ZodError naming the missing variable', () => {
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
  it('parses a complete environment with defaults', () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SUPPORT_EMAIL: 'support@carmart.example',
    })
    expect(env.LOG_LEVEL).toBe('info')
  })
})
