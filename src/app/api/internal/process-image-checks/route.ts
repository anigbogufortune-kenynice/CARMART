import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { runImageChecks } from '@/server/jobs/image-verification/pipeline'
import { requireInternalSecret } from '@/server/jobs/internal-auth'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const Body = z.object({ job_id: z.string().uuid().optional() }).strict()

/** POST /api/internal/process-image-checks: called by Postgres (pg_net) only. */
export async function POST(request: NextRequest) {
  const auth = requireInternalSecret(request, process.env.INTERNAL_JOB_SECRET ?? '')
  if (!auth.ok) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }, { status: 401 })
  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } }, { status: 422 })
  try {
    const result = await runImageChecks(5, parsed.data.job_id)
    return NextResponse.json({ data: { processed: result.processed, requeued: result.requeued, skipped: result.skipped } })
  } catch (e) {
    logger.error('process-image-checks failed', { error: e instanceof Error ? e.stack : String(e) })
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Processing failed' } }, { status: 500 })
  }
}
