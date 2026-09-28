import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { requireInternalSecret } from '@/server/jobs/internal-auth'
import { runDispatch } from '@/server/jobs/notification-dispatch/dispatch'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** POST /api/internal/dispatch-notifications: called by Postgres (pg_net) only. */
export async function POST(request: NextRequest) {
  const auth = requireInternalSecret(request, process.env.INTERNAL_JOB_SECRET ?? '')
  if (!auth.ok) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }, { status: 401 })
  try {
    return NextResponse.json({ data: await runDispatch(50) })
  } catch (e) {
    logger.error('dispatch-notifications failed', { error: e instanceof Error ? e.stack : String(e) })
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Dispatch failed' } }, { status: 500 })
  }
}
