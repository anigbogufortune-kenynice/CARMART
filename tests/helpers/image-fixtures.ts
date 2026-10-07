import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Providers } from '@/server/jobs/image-verification/pipeline'
import { FakeAiCheckProvider, FakeCarCheckProvider } from '@/server/jobs/image-verification/providers/fake.provider'
import { completeUpload, requestUpload } from '@/services/image-upload.service'
import { createDraft } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { asUser, createUser } from './supabase-test'

/** Image-pipeline test fixtures: fake vendors keyed by tests/fixtures/images/manifest.json. */
export const providers: Providers = { car: new FakeCarCheckProvider({ strict: true }), ai: new FakeAiCheckProvider({ strict: true }) }
export const fixture = (name: string) => readFileSync(`tests/fixtures/images/${name}`)
const MIME: Record<string, string> = { jpg: 'image/jpeg', webp: 'image/webp' }

export async function seller(email: string) {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0]}`, city: 'Ikeja', state: 'Lagos' })
  if (!shop.ok) throw new Error(shop.error.message)
  return { db, shopId: shop.value.id }
}

export async function draft(db: SupabaseClient) {
  const d = await createDraft(db, {})
  if (!d.ok) throw new Error(d.error.message)
  return d.value.id
}

/** Upload a fixture through the real upload service and confirm it (→ one queued job). */
export async function uploadFixture(db: SupabaseClient, listingId: string, name: string) {
  const bytes = fixture(name)
  const mime = MIME[name.split('.').pop()!] as 'image/jpeg'
  const req = await requestUpload(db, listingId, { mime_type: mime, bytes: bytes.length })
  if (!req.ok) throw new Error(req.error.message)
  const url = new URL(req.value.upload_url)
  const path = decodeURIComponent(url.pathname.split('/object/upload/sign/listing-quarantine/')[1])
  const up = await db.storage.from('listing-quarantine').uploadToSignedUrl(path, url.searchParams.get('token')!, bytes, { contentType: mime })
  if (up.error) throw new Error(up.error.message)
  const done = await completeUpload(db, listingId, req.value.image_id)
  if (!done.ok) throw new Error(done.error.message)
  return req.value.image_id
}
