// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase Auth is an external service: mocked at the @supabase/ssr boundary.
const exchangeCodeForSession = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession } }),
}))
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn() }),
}))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${qs}`))

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
})

describe('GET /auth/callback', () => {
  it('exchanges the code and redirects to a relative next', async () => {
    const res = await call('?code=abc&next=/sell')
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/sell')
  })

  it.each([
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['', '/'],
  ])('refuses unsafe next %j → %s', async (next, path) => {
    const res = await call(`?code=abc&next=${encodeURIComponent(next)}`)
    expect(res.headers.get('location')).toBe(`http://localhost:3000${path}`)
  })

  it('defaults next to / when absent', async () => {
    expect((await call('?code=abc')).headers.get('location')).toBe('http://localhost:3000/')
  })

  it('sends a missing or failed code to sign-in with an error', async () => {
    expect((await call('?next=/sell')).headers.get('location')).toBe('http://localhost:3000/sign-in?error=link_invalid')
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } })
    expect((await call('?code=old')).headers.get('location')).toBe('http://localhost:3000/sign-in?error=link_invalid')
  })
})
