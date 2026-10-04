import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { runUnpublishListing } from '@/server/jobs/image-verification/publish'
import { requireInternalSecret } from '@/server/jobs/internal-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({ listing_id: z.string().uuid() }).strict()

/** POST /api/internal/unpublish-listing: delete every public variant of a listing. Idempotent. */
export async function POST(request: NextRequest) {
  const auth = requireInternalSecret(request, process.env.INTERNAL_JOB_SECRET ?? '')
  if (!auth.ok) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }, { status: 401 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } }, { status: 422 })
  try {
    return NextResponse.json({ data: await runUnpublishListing(parsed.data.listing_id) })
  } catch (e) {
    logger.error('unpublish-listing failed', { error: e instanceof Error ? e.stack : String(e) })
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Unpublish failed' } }, { status: 500 })
  }
}
