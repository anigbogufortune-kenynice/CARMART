import { expect, type APIRequestContext, type Page } from '@playwright/test'
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

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

/** Poll Mailpit (local Supabase's email catcher) for the newest message to `email`. */
export async function latestEmailText(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages?.length) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string }
      return `${Text}\n${HTML}`
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`No email for ${email} in Mailpit`)
}

/** Sign up through the UI and follow the confirmation email; ends signed in on '/'. */
export async function signUpAndVerify(page: Page, email: string, password = 'long-enough-pass') {
  await page.goto('/sign-up')
  await page.getByLabel('Display name').fill('E2E Seller')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Check your email to verify your account')).toBeVisible()
  const body = await latestEmailText(page.request, email)
  const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0]?.replace(/&amp;/g, '&')
  if (!link) throw new Error('confirmation link missing from email')
  await page.goto(link)
  await page.waitForURL((url) => url.pathname === '/', { waitUntil: 'commit' })
  return { email, password }
}

export async function signInAs(page: Page, email: string, password: string, next = '/') {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname === next.split('?')[0], { waitUntil: 'commit' })
}

/**
 * A live HiLux in an approved shop, created directly (photos marked passed, no files), for journeys
 * that start from a listing. `city` makes it easy to find with the search filters.
 */
export async function createLiveListing(opts: { city: string; slug?: string }) {
  const owner = await createConfirmedUser(`live-owner-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`)
  const admin = e2eAdmin()
  const slug = opts.slug ?? `e2e-shop-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const { data: shop, error: shopError } = await admin.from('shops')
    .insert({ owner_id: owner.id, name: 'E2E Motors', slug, city: opts.city, state: 'Lagos' }).select('id').single()
  if (shopError || !shop) throw new Error(`shop: ${shopError?.message}`)
  await admin.from('shops').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', shop.id)
  const { data: toyota } = await admin.from('vehicle_makes').select('id').eq('name', 'Toyota').single()
  const { data: hilux } = await admin.from('vehicle_models').select('id').eq('make_id', toyota!.id).eq('name', 'HiLux').single()
  const vin = `JTFST22P9${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 17)
  const { data: listing, error } = await admin.from('listings').insert({
    shop_id: shop.id, make_id: toyota!.id, model_id: hilux!.id, year: 2019, odometer_km: 84000, price_cents: 1850000000,
    condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel', colour: 'White', vin,
    state: 'Lagos', city: opts.city, status: 'live', live_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  }).select('id').single()
  if (error || !listing) throw new Error(`listing: ${error?.message}`)
  await admin.from('listing_images').insert([0, 1, 2, 3].map((position) => ({
    listing_id: listing.id, shop_id: shop.id, position, quarantine_path: `${shop.id}/${listing.id}/p${position}`,
    mime_type: 'image/jpeg', bytes: 1000, status: 'passed',
  })))
  return { listingId: listing.id as string, shopSlug: slug, owner }
}
