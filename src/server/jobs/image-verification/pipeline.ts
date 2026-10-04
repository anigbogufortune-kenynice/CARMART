/**
 * Image verification job (docs/systems/image-verification.md → Pipeline steps 1–10).
 * `db` is the service-role client; providers are injected (fake in tests and CI, INV-I6).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { jobsEnv } from '../env'
import { adminClient } from '../supabase-admin'
import { DEFAULT_DECISION_SETTINGS, decide, type DecisionSettings } from './decide'
import { metadataSignals, normalise, phash, stripAndEncode, validate, type MetadataSignals } from './process-image'
import { getProviders, type Providers } from './providers'
import type { AiCheckResult, CarCheckResult } from './providers/types'
import { publishVariants, removeVariants, unpublishImage, type PublicPaths } from './publish'
import type { AppError, Result } from '@/types/result'

export type { Providers }
export type PipelineResult = { processed: number; requeued: number; skipped: number }
type Settings = DecisionSettings & { phashMaxDistance: number }

const QUARANTINE = 'listing-quarantine'
const MAX_ATTEMPTS = 3
const VENDOR_TIMEOUT_MS = 20_000

type Job = { id: string; image_id: string; attempts: number; forced_decision: 'passed' | 'rejected' | null; decision_reason: string | null }
type Image = {
  id: string; listing_id: string; shop_id: string; quarantine_path: string; mime_type: string
  deleted_at: string | null; listing: { status: string } | null
}

const SETTING_KEYS = ['ai_reject_threshold', 'ai_review_threshold', 'car_reject_confidence', 'car_pass_confidence', 'phash_max_distance']

/** Step 3: thresholds read once per job (EC-I8). */
async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data } = await db.from('app_settings').select('key,value').in('key', SETTING_KEYS)
  const v = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]))
  const num = (key: string, fallback: number) => (Number.isFinite(v[key]) ? v[key] : fallback)
  return {
    aiRejectThreshold: num('ai_reject_threshold', DEFAULT_DECISION_SETTINGS.aiRejectThreshold),
    aiReviewThreshold: num('ai_review_threshold', DEFAULT_DECISION_SETTINGS.aiReviewThreshold),
    carRejectConfidence: num('car_reject_confidence', DEFAULT_DECISION_SETTINGS.carRejectConfidence),
    carPassConfidence: num('car_pass_confidence', DEFAULT_DECISION_SETTINGS.carPassConfidence),
    phashMaxDistance: num('phash_max_distance', 6),
  }
}

function withTimeout<T>(p: Promise<Result<T, AppError>>, ms: number, name: string): Promise<Result<T, AppError>> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<Result<T, AppError>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: { code: 'VENDOR_TIMEOUT', message: `${name} timed out after ${ms} ms` } }), ms)
  })
  return Promise.race([p.catch((e: unknown) => ({ ok: false as const, error: { code: 'VENDOR_ERROR', message: String(e) } })), timeout])
    .finally(() => clearTimeout(timer))
}

const carJson = (c: CarCheckResult) => ({
  provider: c.provider, is_car: c.isCar, confidence: c.confidence, view: c.view, is_screen_or_print: c.isScreenOrPrint,
  plate_visible: c.plateVisible, face_visible: c.faceVisible, notes: c.notes,
})
const aiJson = (a: AiCheckResult) => ({ provider: a.provider, score: a.score, raw: a.raw })

type Record_ = {
  decision: 'passed' | 'rejected' | 'in_review'; reason: string | null; car?: object | null; ai?: object | null
  signals?: MetadataSignals | null; phashMatch?: object | null; thresholds?: Settings | null; phash?: string | null
  width?: number | null; height?: number | null; publicPaths?: PublicPaths | null; error?: string | null
}

async function record(db: SupabaseClient, jobId: string, r: Record_): Promise<'RECORDED' | 'SKIPPED'> {
  const { data, error } = await db.rpc('record_image_decision', {
    p_job_id: jobId, p_decision: r.decision, p_reason: r.reason, p_car: r.car ?? null, p_ai: r.ai ?? null,
    p_signals: r.signals ?? null, p_phash_match: r.phashMatch ?? null, p_thresholds: r.thresholds ?? null,
    p_phash: r.phash ?? null, p_width: r.width ?? null, p_height: r.height ?? null,
    p_public_paths: r.publicPaths ?? null, p_error: r.error ?? null,
  })
  if (error) throw new Error(`record_image_decision failed: ${error.message}`)
  return data as 'RECORDED' | 'SKIPPED'
}

/** Record, and if the photo vanished meanwhile (EC-I4/EC-I5) delete the variants just uploaded. */
async function commit(db: SupabaseClient, jobId: string, r: Record_): Promise<'RECORDED' | 'SKIPPED'> {
  const outcome = await record(db, jobId, r)
  if (outcome === 'SKIPPED' && r.publicPaths) await removeVariants(db, r.publicPaths)
  return outcome
}

async function download(db: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(QUARANTINE).download(path)
  if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no data'}`)
  return Buffer.from(await data.arrayBuffer())
}

type Outcome = 'processed' | 'requeued' | 'skipped'

async function processJob(db: SupabaseClient, job: Job, providers: Providers): Promise<Outcome> {
  // Step 1: load; a deleted photo or removed listing is skipped.
  const { data } = await db
    .from('listing_images')
    .select('id,listing_id,shop_id,quarantine_path,mime_type,deleted_at,listing:listings(status)')
    .eq('id', job.image_id)
    .maybeSingle()
  const img = data as unknown as Image | null
  if (!img || img.deleted_at || img.listing?.status === 'removed') {
    if (img) await record(db, job.id, { decision: 'in_review', reason: null })
    return 'skipped'
  }

  // Step 2: an admin's forced decision skips the vendor checks.
  if (job.forced_decision === 'rejected') {
    await unpublishImage(db, img.id)
    return (await commit(db, job.id, { decision: 'rejected', reason: job.decision_reason })) === 'RECORDED' ? 'processed' : 'skipped'
  }
  const original = await download(db, img.quarantine_path)
  if (job.forced_decision === 'passed') {
    const publicPaths = await publishVariants(db, img.listing_id, img.id, await stripAndEncode(original))
    return (await commit(db, job.id, { decision: 'passed', reason: null, publicPaths })) === 'RECORDED' ? 'processed' : 'skipped'
  }

  const settings = await loadSettings(db)
  // Step 5: validate (D1).
  const valid = await validate(original, img.mime_type)
  if (!valid.ok) {
    const d = decide({ validationError: valid.reason }, settings)
    return (await commit(db, job.id, { decision: d.outcome, reason: d.sellerReason, thresholds: settings })) === 'RECORDED' ? 'processed' : 'skipped'
  }

  // Steps 6–7: normalise, fingerprint, signals, cross-shop reuse.
  const analysis = await normalise(original)
  const hash = await phash(analysis)
  const signals = await metadataSignals(original)
  const { data: matches, error: matchError } = await db.rpc('find_phash_match', {
    p_image_id: img.id, p_phash: hash, p_max_distance: settings.phashMaxDistance,
  })
  if (matchError) throw new Error(`find_phash_match failed: ${matchError.message}`)
  const match = ((matches ?? []) as { matched_image_id: string; matched_shop_id: string; distance: number }[])[0] ?? null

  // Step 8: vendor checks in parallel, each with a timeout.
  const [car, ai] = await Promise.all([
    withTimeout(providers.car.check(analysis), VENDOR_TIMEOUT_MS, 'car check'),
    withTimeout(providers.ai.check(original, img.mime_type), VENDOR_TIMEOUT_MS, 'AI check'),
  ])
  const base = {
    signals, thresholds: settings, phash: hash, width: valid.width, height: valid.height, phashMatch: match,
    car: car.ok ? carJson(car.value) : null, ai: ai.ok ? aiJson(ai.value) : null,
  }
  if (!car.ok || !ai.ok) {
    const message = [car.ok ? null : `car: ${car.error.message}`, ai.ok ? null : `ai: ${ai.error.message}`].filter(Boolean).join('; ')
    if (job.attempts < MAX_ATTEMPTS) {
      await db.rpc('requeue_image_check', { p_job_id: job.id, p_error: message })
      return 'requeued'
    }
    const d = decide({ vendorFailed: true }, settings) // D9
    return (await commit(db, job.id, { ...base, decision: d.outcome, reason: d.sellerReason, error: message })) === 'RECORDED' ? 'processed' : 'skipped'
  }

  // Step 9: decide; publish variants before the database points at them.
  const d = decide({
    car: car.value, ai: ai.value,
    phashMatch: match && { matchedImageId: match.matched_image_id, matchedShopId: match.matched_shop_id, distance: match.distance },
  }, settings)
  const publicPaths = d.outcome === 'passed' ? await publishVariants(db, img.listing_id, img.id, await stripAndEncode(original)) : null
  // Step 10: commit.
  return (await commit(db, job.id, { ...base, decision: d.outcome, reason: d.sellerReason, publicPaths })) === 'RECORDED' ? 'processed' : 'skipped'
}

/** Claim up to `limit` queued jobs (or one specific job) and run each through the pipeline. */
export async function processNextJobs(
  db: SupabaseClient, limit: number, providers: Providers, jobId?: string,
): Promise<PipelineResult> {
  const result: PipelineResult = { processed: 0, requeued: 0, skipped: 0 }
  const { data, error } = await db.rpc('claim_image_check', { p_limit: limit, p_job_id: jobId ?? null })
  if (error) throw new Error(`claim_image_check failed: ${error.message}`)
  for (const job of (data ?? []) as Job[]) {
    try {
      result[await processJob(db, job, providers)]++
    } catch (e) {
      // Unexpected failure (storage, sharp, database): same retry budget as a vendor error.
      const message = e instanceof Error ? e.message : String(e)
      logger.error('image check failed', { jobId: job.id, imageId: job.image_id, attempts: job.attempts, error: message })
      if (job.attempts < MAX_ATTEMPTS) {
        await db.rpc('requeue_image_check', { p_job_id: job.id, p_error: message })
        result.requeued++
      } else {
        await record(db, job.id, { decision: 'in_review', reason: decide({ vendorFailed: true }, DEFAULT_DECISION_SETTINGS).sellerReason, error: message })
        result.processed++
      }
    }
  }
  return result
}

/** Entry point for POST /api/internal/process-image-checks. */
export async function runImageChecks(limit: number, jobId?: string): Promise<PipelineResult> {
  return processNextJobs(adminClient(), limit, getProviders(jobsEnv(['images'])), jobId)
}
