import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { processNextJobs, type Providers } from '@/server/jobs/image-verification/pipeline'
import { submitListing } from '@/services/listing-lifecycle.service'
import { decideImage } from '@/services/moderation.service'
import { providers, uploadFixture, warmStorage } from '../helpers/image-fixtures'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

beforeAll(warmStorage, 150_000)
afterEach(async () => {
  await resetDb()
})

/** The real fake providers, counting calls (so a forced decision can prove it skipped them). */
function counting(): { providers: Providers; calls: () => number } {
  let n = 0
  return {
    calls: () => n,
    providers: {
      car: { check: (...a: Parameters<Providers['car']['check']>) => { n++; return providers.car.check(...a) } },
      ai: { check: (...a: Parameters<Providers['ai']['check']>) => { n++; return providers.ai.check(...a) } },
    },
  }
}

const listing = async (id: string) => (await adminDb().from('listings').select('status,review_flags').eq('id', id).single()).data!
const image = async (id: string) => (await adminDb().from('listing_images').select('status,status_reason,public_paths').eq('id', id).single()).data!
const publicFiles = async (listingId: string) => ((await adminDb().storage.from('listing-public').list(listingId)).data ?? []).map((f) => f.name)

/** A submitted listing with `passed` directly-inserted passed photos plus one real uploaded fixture, processed. */
async function listingWith(passed: number, fixture: string) {
  const { db, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const id = await completeDraft(db, shopId, { photos: passed })
  const photo = await uploadFixture(db, id, fixture)
  const submitted = await submitListing(db, id, 1)
  if (!submitted.ok) throw new Error(submitted.error.message)
  await processNextJobs(adminDb(), 5, providers)
  return { owner: db, id, photo }
}

async function admin(): Promise<SupabaseClient> {
  return asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
}

describe('decideImage', { timeout: 90_000 }, () => {
  it('approve: the forced job skips the vendors, publishes the photo and the listing goes live; 1 audit row', async () => {
    const { id, photo } = await listingWith(3, 'borderline-ai.jpg')
    expect(await listing(id)).toMatchObject({ status: 'in_review' })
    const a = await admin()
    expect(await decideImage(a, photo, 'approve')).toMatchObject({ ok: true })
    const c = counting()
    await processNextJobs(adminDb(), 5, c.providers)
    expect(c.calls()).toBe(0)
    expect(await image(photo)).toMatchObject({ status: 'passed', public_paths: { md: `${id}/${photo}-md.webp` } })
    expect(await listing(id)).toMatchObject({ status: 'live' })
    const { data: audit } = await adminDb().from('admin_actions').select('action,target_id').eq('target_id', photo)
    expect(audit).toEqual([{ action: 'image.approve', target_id: photo }])
  })

  it('reject an in_review photo → rejected with the reason; the listing → rejected', async () => {
    const { id, photo } = await listingWith(3, 'borderline-ai.jpg')
    expect(await decideImage(await admin(), photo, 'reject', 'This photo is of a different car')).toMatchObject({ ok: true })
    await processNextJobs(adminDb(), 5, providers)
    expect(await image(photo)).toMatchObject({ status: 'rejected', status_reason: 'This photo is of a different car' })
    expect(await listing(id)).toMatchObject({ status: 'rejected' })
  })

  it('reject a passed photo on a live listing with 5 → variants deleted, still live with 4', async () => {
    const { id, photo } = await listingWith(4, 'car-exterior.jpg')
    expect(await listing(id)).toMatchObject({ status: 'live' })
    expect(await publicFiles(id)).toHaveLength(3)
    expect(await decideImage(await admin(), photo, 'reject', 'Shows a number plate clearly')).toMatchObject({ ok: true })
    await processNextJobs(adminDb(), 5, providers)
    expect(await image(photo)).toMatchObject({ status: 'rejected', public_paths: null })
    expect(await publicFiles(id)).toEqual([])
    expect(await listing(id)).toMatchObject({ status: 'live' })
  })

  it('reject a passed photo on a live listing with exactly 4 → in_review with image_review', async () => {
    const { id, photo } = await listingWith(3, 'car-exterior.jpg')
    expect(await listing(id)).toMatchObject({ status: 'live' })
    await decideImage(await admin(), photo, 'reject', 'Shows a number plate clearly')
    await processNextJobs(adminDb(), 5, providers)
    const after = await listing(id)
    expect(after.status).toBe('in_review')
    expect(after.review_flags).toContain('image_review')
  })

  it('guards: short reason → REASON_REQUIRED; approving a passed photo → INVALID_STATE; non-admin → FORBIDDEN', async () => {
    const { owner, photo } = await listingWith(4, 'car-exterior.jpg')
    const a = await admin()
    expect(await decideImage(a, photo, 'reject', 'bad')).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await decideImage(a, photo, 'approve')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
    expect(await decideImage(owner, photo, 'reject', 'Not allowed here')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
