// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { err, ok } from '@/types/result'

// Supabase is external: mocked at the @supabase/ssr boundary.
type FakeUser = { id: string; email_confirmed_at: string | null } | null
let currentUser: FakeUser = null
let currentProfile: { role: string; status: string } | null = null
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: currentProfile, error: null }) }) }) }),
  }),
}))
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [], set: vi.fn() }) }))
const logError = vi.fn()
vi.mock('@/lib/logger', () => ({ logger: { error: (...a: unknown[]) => logError(...a), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { statusFor, withRoute } from './route-helpers'

const post = (body: unknown, raw = false) =>
  new NextRequest('http://localhost:3000/api/x', { method: 'POST', body: raw ? (body as string) : JSON.stringify(body) })
const ctx = { params: {} }
const json = async (r: Response) => ({ status: r.status, body: await r.json() })

beforeEach(() => {
  currentUser = { id: 'u1', email_confirmed_at: '2026-09-28T00:00:00Z' }
  currentProfile = { role: 'user', status: 'active' }
  logError.mockReset()
})

describe('withRoute: parsing', () => {
  const route = withRoute({ auth: 'user', body: z.object({ a: z.string() }).strict() }, async ({ body }) => ok(body))

  it('422 VALIDATION_ERROR naming the failing field', async () => {
    const r = await json(await route(post({ a: 1 }), ctx))
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    expect(r.body.error.message).toContain('a')
  })

  it('an issue whose message is an error code becomes the response code', async () => {
    const coded = withRoute({ auth: 'public', body: z.object({ v: z.string().length(3, 'INVALID_VIN') }) }, async ({ body }) => ok(body))
    const r = await json(await coded(post({ v: 'toolong' }), ctx))
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('INVALID_VIN')
  })

  it('rejects unknown keys on strict bodies', async () => {
    expect((await route(post({ a: 'x', extra: 1 }), ctx)).status).toBe(422)
  })

  it('400 on malformed JSON', async () => {
    expect((await json(await route(post('{nope', true), ctx))).body.error.code).toBe('BAD_REQUEST')
  })

  it('passes the parsed body to the handler and wraps it in { data }', async () => {
    expect(await json(await route(post({ a: 'x' }), ctx))).toEqual({ status: 200, body: { data: { a: 'x' } } })
  })
})

describe('withRoute: auth levels', () => {
  const route = withRoute({ auth: 'user' }, async () => ok('fine'))
  const adminRoute = withRoute({ auth: 'admin' }, async () => ok('fine'))
  const get = () => new NextRequest('http://localhost:3000/api/x')

  it('401 without a session', async () => {
    currentUser = null
    expect((await json(await route(get(), ctx))).body.error.code).toBe('UNAUTHENTICATED')
  })
  it('403 EMAIL_NOT_VERIFIED', async () => {
    currentUser = { id: 'u1', email_confirmed_at: null }
    expect(await json(await route(get(), ctx))).toMatchObject({ status: 403, body: { error: { code: 'EMAIL_NOT_VERIFIED' } } })
  })
  it('403 ACCOUNT_SUSPENDED', async () => {
    currentProfile = { role: 'user', status: 'suspended' }
    expect(await json(await route(get(), ctx))).toMatchObject({ status: 403, body: { error: { code: 'ACCOUNT_SUSPENDED' } } })
  })
  it('403 FORBIDDEN for non-admins on admin routes; admins pass', async () => {
    expect((await json(await adminRoute(get(), ctx))).body.error.code).toBe('FORBIDDEN')
    currentProfile = { role: 'admin', status: 'active' }
    expect((await adminRoute(get(), ctx)).status).toBe(200)
  })
  it('public routes skip auth entirely', async () => {
    currentUser = null
    expect((await withRoute({ auth: 'public' }, async () => ok(1))(get(), ctx)).status).toBe(200)
  })
})

describe('withRoute: results and failures', () => {
  const get = () => new NextRequest('http://localhost:3000/api/x')

  it('maps Result error codes to HTTP statuses', async () => {
    const r = await withRoute({ auth: 'user' }, async () => err({ code: 'SHOP_ALREADY_EXISTS', message: 'x' }))(get(), ctx)
    expect(r.status).toBe(409)
    expect(statusFor('UPLOAD_LIMIT')).toBe(429)
    expect(statusFor('NOT_FOUND')).toBe(404)
    expect(statusFor('INVALID_VIN')).toBe(422)
  })

  it('uses successStatus and 204 for empty bodies', async () => {
    expect((await withRoute({ auth: 'user', successStatus: 201 }, async () => ok({ id: 1 }))(get(), ctx)).status).toBe(201)
    const r = await withRoute({ auth: 'user', successStatus: 204 }, async () => ok(undefined))(get(), ctx)
    expect(r.status).toBe(204)
  })

  it('500 with a request id on unexpected throws, logged once, no details leaked', async () => {
    const r = await json(await withRoute({ auth: 'user' }, async () => { throw new Error('db password is hunter2') })(get(), ctx))
    expect(r.status).toBe(500)
    expect(r.body.error.code).toBe('INTERNAL_ERROR')
    expect(r.body.error.requestId).toMatch(/[0-9a-f-]{36}/)
    expect(JSON.stringify(r.body)).not.toContain('hunter2')
    expect(logError).toHaveBeenCalledTimes(1)
  })
})
