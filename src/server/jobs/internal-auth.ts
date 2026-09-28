import { timingSafeEqual } from 'node:crypto'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Internal job routes are called only by Postgres (pg_net) with
 * `Authorization: Bearer <INTERNAL_JOB_SECRET>`. Constant-time comparison.
 */
export function requireInternalSecret(req: Request, secret: string): Result<true, AppError> {
  const denied = err({ code: 'UNAUTHENTICATED', message: 'Unauthorized' })
  if (!secret || secret.length < 32) return denied
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return denied
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  if (given.length !== expected.length) return denied
  return timingSafeEqual(given, expected) ? ok(true) : denied
}
