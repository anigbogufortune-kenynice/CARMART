import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

/** Service-role client for E2E setup only (never app code; see ADR-006). */
export function e2eAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Create a confirmed user directly (fast path for journeys that don't test sign-up itself). */
export async function createConfirmedUser(email: string, password = 'long-enough-pass') {
  const { data, error } = await e2eAdmin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createConfirmedUser: ${error?.message}`)
  return { id: data.user.id, email, password }
}

/**
 * A unique JPEG that the fake providers recognise by its corner marker (see
 * tests/fixtures/images/manifest.json). Random shapes make each one a different photo, so the
 * cross-shop reuse check never links photos from different tests.
 */
export async function markedPhoto(marker: [number, number, number]): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  const width = 1200
  const height = 900
  const shapes = await Promise.all(Array.from({ length: 6 }, async () => {
    const w = Math.round(width * (0.15 + Math.random() * 0.3))
    const h = Math.round(height * (0.15 + Math.random() * 0.3))
    const shade = () => Math.round(Math.random() * 255)
    const input = await sharp({ create: { width: w, height: h, channels: 3, background: { r: shade(), g: shade(), b: shade() } } }).png().toBuffer()
    return { input, left: Math.round(width * 0.15 + Math.random() * (width * 0.85 - w)), top: Math.round(Math.random() * (height - h)) }
  }))
  const block = Math.round(width * 0.12)
  const corner = await sharp({ create: { width: block, height: block, channels: 3, background: { r: marker[0], g: marker[1], b: marker[2] } } }).png().toBuffer()
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 130, b: 140 } } })
    .composite([...shapes, { input: corner, left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer()
}

export const MARKERS = { carExterior: [220, 40, 40], dog: [40, 40, 220] } as const satisfies Record<string, [number, number, number]>

/** Run queued image checks now, as pg_net would (a no-op when pg_net already did). */
export async function runImageChecks(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/internal/process-image-checks', {
    headers: { Authorization: `Bearer ${process.env.INTERNAL_JOB_SECRET}` }, data: {},
  })
  if (!res.ok()) throw new Error(`process-image-checks: ${res.status()} ${await res.text()}`)
}
