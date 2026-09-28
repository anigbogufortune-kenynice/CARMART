// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// The Supabase client is external: it "refreshes" and asks us to write a cookie + header.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => ({
    auth: {
      getUser: async () => {
        opts.cookies.setAll([{ name: 'sb-test-auth-token', value: 'fresh', options: { path: '/' } }], { 'Cache-Control': 'private, no-store' })
        return { data: { user: null } }
      },
    },
  }),
}))

import { config } from '../../middleware'
import { updateSession } from './middleware'

describe('updateSession', () => {
  it('writes refreshed auth cookies and cache headers onto the response', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    const res = await updateSession(new NextRequest('http://localhost:3000/sell'))
    expect(res.cookies.get('sb-test-auth-token')?.value).toBe('fresh')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('matcher skips static assets, images and internal job routes', () => {
    const matcher = config.matcher[0]
    expect(matcher).toContain('_next/static')
    expect(matcher).toContain('api/internal')
    expect(matcher).toMatch(/svg\|png\|jpg/)
  })
})
