/**
 * Entry point for the Netlify background function `process-image-checks` (ADR-014). Netlify runs
 * `sharp` in plain functions, not in the Next.js server, and a background function may run for
 * 15 minutes, so it drains the queue instead of stopping after one batch.
 */
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requireInternalSecret } from '../internal-auth'
import type { PipelineResult } from './pipeline'

type Runner = (limit: number, jobId?: string) => Promise<PipelineResult>

const BATCH = 5
const Body = z.object({ job_id: z.string().uuid().optional() }).strict()

/** Claim batches until nothing is left to process (requeued vendor retries wait for the next cron tick). */
export async function drainImageChecks(run: Runner, jobId?: string, maxRounds = 40): Promise<PipelineResult> {
  const total: PipelineResult = { processed: 0, requeued: 0, skipped: 0 }
  for (let round = 0; round < maxRounds; round++) {
    const r = await run(BATCH, jobId)
    total.processed += r.processed
    total.requeued += r.requeued
    total.skipped += r.skipped
    if (jobId || r.processed + r.skipped === 0) break
  }
  return total
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function handleImageCheckRequest(req: Request, secret: string, run: Runner): Promise<Response> {
  if (!requireInternalSecret(req, secret).ok) return json({ error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }, 401)
  let raw: unknown = {}
  try {
    const text = await req.text()
    if (text.trim()) raw = JSON.parse(text)
  } catch {
    raw = null
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) return json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } }, 422)
  try {
    return json({ data: await drainImageChecks(run, parsed.data.job_id) }, 200)
  } catch (e) {
    logger.error('process-image-checks (background) failed', { error: e instanceof Error ? e.stack : String(e) })
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Processing failed' } }, 500)
  }
}
