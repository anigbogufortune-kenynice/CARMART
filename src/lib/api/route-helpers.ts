import { randomUUID } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { ZodType, z } from 'zod'
import { logger } from '@/lib/logger'
import { createServerSupabase } from '@/lib/supabase/server'
import type { AppError, Result } from '@/types/result'

/**
 * Shared route-handler pipeline (CLAUDE.md: Zod → auth → service → response).
 * Every /api route handler is `export const GET = withRoute({...}, handler)`.
 */

export type AuthLevel = 'public' | 'user' | 'admin'

/** HTTP status per error code (docs/api-contracts.md). Unlisted codes are business-rule 422s. */
const STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  EMAIL_NOT_VERIFIED: 403, ACCOUNT_SUSPENDED: 403, FORBIDDEN: 403, OWN_LISTING: 403, CONVERSATION_BLOCKED: 403,
  NOT_FOUND: 404, SHOP_NOT_FOUND: 404, PHONE_NOT_AVAILABLE: 404,
  INVALID_STATE: 409, VERSION_CONFLICT: 409, SHOP_ALREADY_EXISTS: 409, SLUG_TAKEN: 409, SLUG_LOCKED: 409,
  PHONE_IN_USE: 409, DUPLICATE_LISTING: 409, UPLOAD_MISSING: 409, ALREADY_REPORTED: 409, VIN_STILL_LIVE: 409,
  OWNER_SUSPENDED: 409,
  RATE_LIMITED: 429, UPLOAD_LIMIT: 429, CONVERSATION_LIMIT: 429, REPORT_LIMIT: 429,
  INTERNAL_ERROR: 500,
}

export function statusFor(code: string): number {
  return STATUS[code] ?? 422
}

export type RouteContext<B, Q> = {
  req: NextRequest
  params: Record<string, string>
  body: B
  query: Q
  db: SupabaseClient
  user: User | null
  requestId: string
}

type Options<BS extends ZodType | undefined, QS extends ZodType | undefined> = {
  auth: AuthLevel
  body?: BS
  query?: QS
  successStatus?: 200 | 201 | 202 | 204
}

type Infer<S> = S extends ZodType ? z.infer<S> : undefined

const fail = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: { code, message, ...extra } }, { status: statusFor(code) })

function zodMessage(error: z.ZodError): string {
  const first = error.issues[0]
  const path = first?.path.join('.') || 'body'
  return `${path}: ${first?.message ?? 'invalid'}`
}

export function withRoute<BS extends ZodType | undefined = undefined, QS extends ZodType | undefined = undefined, T = unknown>(
  options: Options<BS, QS>,
  handler: (ctx: RouteContext<Infer<BS>, Infer<QS>>) => Promise<Result<T, AppError>>,
) {
  return async (req: NextRequest, context: { params: Record<string, string> }): Promise<NextResponse> => {
    const requestId = randomUUID()
    try {
      // ── parse ──────────────────────────────────────────────────────────────
      let body: unknown = undefined
      if (options.body) {
        let raw: unknown
        try {
          raw = await req.json()
        } catch {
          return fail('BAD_REQUEST', 'Malformed JSON body')
        }
        const parsed = options.body.safeParse(raw)
        if (!parsed.success) return fail('VALIDATION_ERROR', zodMessage(parsed.error))
        body = parsed.data
      }
      let query: unknown = undefined
      if (options.query) {
        const parsed = options.query.safeParse(Object.fromEntries(req.nextUrl.searchParams))
        if (!parsed.success) return fail('VALIDATION_ERROR', zodMessage(parsed.error))
        query = parsed.data
      }

      // ── auth ───────────────────────────────────────────────────────────────
      const db = createServerSupabase()
      let user: User | null = null
      if (options.auth !== 'public') {
        const { data } = await db.auth.getUser()
        user = data.user
        if (!user) return fail('UNAUTHENTICATED', 'Sign in to continue')
        if (!user.email_confirmed_at) return fail('EMAIL_NOT_VERIFIED', 'Verify your email to continue')
        const { data: profile } = await db.from('profiles').select('role,status').eq('id', user.id).maybeSingle()
        if (!profile || profile.status === 'suspended') return fail('ACCOUNT_SUSPENDED', 'This account is suspended')
        if (options.auth === 'admin' && profile.role !== 'admin') return fail('FORBIDDEN', 'Admins only')
      }

      // ── service ────────────────────────────────────────────────────────────
      const result = await handler({
        req, params: context.params ?? {}, body: body as Infer<BS>, query: query as Infer<QS>, db, user, requestId,
      })
      if (!result.ok) return fail(result.error.code, result.error.message)
      const status = options.successStatus ?? 200
      if (status === 204) return new NextResponse(null, { status: 204 })
      return NextResponse.json({ data: result.value }, { status })
    } catch (e) {
      logger.error('route handler failed', {
        requestId, path: req.nextUrl.pathname, error: e instanceof Error ? e.stack : String(e),
      })
      return fail('INTERNAL_ERROR', 'Something went wrong. Please try again.', { requestId })
    }
  }
}
