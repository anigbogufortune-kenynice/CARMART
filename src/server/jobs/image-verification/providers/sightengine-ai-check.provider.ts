/**
 * AI-generation check with Sightengine (docs/systems/image-verification.md → Sightengine AI check).
 * The ORIGINAL bytes are sent: detectors may rely on artifacts that re-encoding destroys.
 */
import { err, ok, type AppError, type Result } from '@/types/result'
import type { AiCheckProvider, AiCheckResult } from './types'

export const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json'
const TIMEOUT_MS = 20_000

const vendorError = (message: string): AppError => ({ code: 'VENDOR_ERROR', message: `Sightengine: ${message}` })

export class SightengineAiCheckProvider implements AiCheckProvider {
  constructor(
    private readonly apiUser: string,
    private readonly apiSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async check(original: Buffer, mime: string): Promise<Result<AiCheckResult, AppError>> {
    const form = new FormData()
    form.append('media', new Blob([new Uint8Array(original)], { type: mime }), 'photo')
    form.append('models', 'genai')
    form.append('api_user', this.apiUser)
    form.append('api_secret', this.apiSecret)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await this.fetchImpl(SIGHTENGINE_URL, { method: 'POST', body: form, signal: controller.signal })
      if (res.status >= 400) return err(vendorError(`HTTP ${res.status}`))
      const body = (await res.json()) as { status?: string; type?: { ai_generated?: unknown }; error?: { message?: string } }
      if (body.status !== 'success') return err(vendorError(body.error?.message ?? `status ${body.status ?? 'missing'}`))
      const score = body.type?.ai_generated
      if (typeof score !== 'number' || score < 0 || score > 1) return err(vendorError('missing type.ai_generated'))
      return ok({ provider: 'sightengine', score, raw: body })
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      return err(vendorError(aborted ? `timed out after ${TIMEOUT_MS / 1000} s` : e instanceof Error ? e.message : String(e)))
    } finally {
      clearTimeout(timer)
    }
  }
}
