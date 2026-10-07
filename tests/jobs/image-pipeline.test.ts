import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { REASONS } from '@/server/jobs/image-verification/decide'
import { processNextJobs } from '@/server/jobs/image-verification/pipeline'
import { VALIDATION_REASONS } from '@/server/jobs/image-verification/process-image'
import { unpublishListing } from '@/server/jobs/image-verification/publish'
import { draft, providers, seller, uploadFixture } from '../helpers/image-fixtures'
import { adminDb, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const image = async (id: string) =>
  (await adminDb().from('listing_images').select('status,status_reason,public_paths,phash,width,height').eq('id', id).single()).data!
const job = async (imageId: string) =>
  (await adminDb().from('image_checks').select('*').eq('image_id', imageId).order('created_at', { ascending: false }).limit(1).single()).data!

describe('claim and record RPCs', () => {
  it('two concurrent claims on one queued job: exactly one wins', async () => {
    const { db } = await seller('a@x.au')
    await uploadFixture(db, await draft(db), 'car-exterior.jpg')
    const [a, b] = await Promise.all([
      adminDb().rpc('claim_image_check', { p_limit: 1 }),
      adminDb().rpc('claim_image_check', { p_limit: 1 }),
    ])
    expect([(a.data ?? []).length, (b.data ?? []).length].sort()).toEqual([0, 1])
  })

  it('record_image_decision skips a deleted photo and changes nothing', async () => {
    const { db } = await seller('a@x.au')
    const imageId = await uploadFixture(db, await draft(db), 'car-exterior.jpg')
    const claimed = await adminDb().rpc('claim_image_check', { p_limit: 1 })
    await adminDb().from('listing_images').update({ deleted_at: new Date().toISOString() }).eq('id', imageId)
    const res = await adminDb().rpc('record_image_decision', { p_job_id: claimed.data![0].id, p_decision: 'passed', p_reason: null })
    expect(res.data).toBe('SKIPPED')
    expect((await image(imageId)).status).toBe('checking')
    expect((await job(imageId)).decision).toBeNull()
  })

  it('clients cannot call the job RPCs', async () => {
    const { db } = await seller('a@x.au')
    expect((await db.rpc('claim_image_check', { p_limit: 1 })).error).not.toBeNull()
  })
})

describe('processNextJobs (fake providers)', () => {
  it('passes, rejects and reviews by the decision table; only the passed photo is published, metadata-free', async () => {
    const { db } = await seller('a@x.au')
    const listingId = await draft(db)
    const car = await uploadFixture(db, listingId, 'with-gps.jpg')
    const dog = await uploadFixture(db, listingId, 'dog.jpg')
    const borderline = await uploadFixture(db, listingId, 'borderline-ai.jpg')

    expect(await processNextJobs(adminDb(), 5, providers)).toEqual({ processed: 3, requeued: 0, skipped: 0 })

    const passed = await image(car)
    expect(passed).toMatchObject({ status: 'passed', status_reason: null, width: 1600, height: 1200 })
    expect(passed.phash).toMatch(/^[01]{64}$/)
    expect(passed.public_paths).toEqual({ sm: `${listingId}/${car}-sm.webp`, md: `${listingId}/${car}-md.webp`, lg: `${listingId}/${car}-lg.webp` })
    expect(await image(dog)).toMatchObject({ status: 'rejected', status_reason: REASONS.notACar, public_paths: null })
    expect(await image(borderline)).toMatchObject({ status: 'in_review', status_reason: REASONS.review, public_paths: null })

    const files = (await adminDb().storage.from('listing-public').list(listingId)).data!.map((f) => f.name).sort()
    expect(files).toEqual([`${car}-lg.webp`, `${car}-md.webp`, `${car}-sm.webp`])
    const md = await adminDb().storage.from('listing-public').download(`${listingId}/${car}-md.webp`)
    const meta = await sharp(Buffer.from(await md.data!.arrayBuffer())).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 1024 })
    expect(meta.exif).toBeUndefined()

    const evidence = await job(car)
    expect(evidence).toMatchObject({ state: 'done', decision: 'passed', attempts: 1 })
    expect(evidence.car_check).toMatchObject({ provider: 'fake', is_car: true })
    expect(evidence.ai_check).toMatchObject({ provider: 'fake', score: 0.02 })
    expect(evidence.metadata_signals).toMatchObject({ has_exif: true, camera_make: 'Canon' })
    expect(evidence.thresholds).toMatchObject({ aiRejectThreshold: 0.9, phashMaxDistance: 6 })

    // A done job is never reprocessed.
    expect(await processNextJobs(adminDb(), 5, providers)).toEqual({ processed: 0, requeued: 0, skipped: 0 })

    // Unpublishing the listing (removed / old sold, issue 024) deletes its variants and clears the paths; idempotent.
    expect(await unpublishListing(adminDb(), listingId)).toEqual({ deleted: 3 })
    expect((await adminDb().storage.from('listing-public').list(listingId)).data ?? []).toEqual([])
    expect((await image(car)).public_paths).toBeNull()
    expect(await unpublishListing(adminDb(), listingId)).toEqual({ deleted: 0 })
  })

  it('rejects tiny, animated and undecodable files with the D1 reasons', async () => {
    const { db } = await seller('a@x.au')
    const listingId = await draft(db)
    const tiny = await uploadFixture(db, listingId, 'tiny.jpg')
    const animated = await uploadFixture(db, listingId, 'animated.webp')
    const junk = await uploadFixture(db, listingId, 'not-an-image.jpg')
    await processNextJobs(adminDb(), 5, providers)
    expect(await image(tiny)).toMatchObject({ status: 'rejected', status_reason: VALIDATION_REASONS.tooSmall })
    expect(await image(animated)).toMatchObject({ status: 'rejected', status_reason: VALIDATION_REASONS.animated })
    expect(await image(junk)).toMatchObject({ status: 'rejected', status_reason: VALIDATION_REASONS.unreadable })
  })

  it('a vendor error is retried, then goes to review after 3 attempts (D9)', async () => {
    const { db } = await seller('a@x.au')
    const imageId = await uploadFixture(db, await draft(db), 'vendor-error.jpg')
    expect(await processNextJobs(adminDb(), 5, providers)).toMatchObject({ requeued: 1 })
    expect((await job(imageId)).state).toBe('queued')
    expect(await processNextJobs(adminDb(), 5, providers)).toMatchObject({ requeued: 1 })
    expect(await processNextJobs(adminDb(), 5, providers)).toMatchObject({ processed: 1 })
    expect(await image(imageId)).toMatchObject({ status: 'in_review', status_reason: REASONS.vendorUnavailable })
    const evidence = await job(imageId)
    expect(evidence).toMatchObject({ state: 'done', attempts: 3, decision: 'in_review' })
    expect(evidence.last_error).toContain('Fake vendor error')
  })

  it('the same photo from a different shop goes to review with the match recorded; the same shop is not flagged', async () => {
    const a = await seller('a@x.au')
    const first = await uploadFixture(a.db, await draft(a.db), 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)
    expect((await image(first)).status).toBe('passed')

    const again = await uploadFixture(a.db, await draft(a.db), 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)
    expect((await image(again)).status).toBe('passed')

    const b = await seller('b@x.au')
    const reused = await uploadFixture(b.db, await draft(b.db), 'car-exterior.jpg')
    await processNextJobs(adminDb(), 5, providers)
    expect(await image(reused)).toMatchObject({ status: 'in_review', status_reason: REASONS.review })
    expect((await job(reused)).phash_match).toMatchObject({ matched_shop_id: a.shopId, distance: 0 })
  })

  it('a photo deleted before processing is skipped and nothing is published (EC-I4)', async () => {
    const { db } = await seller('a@x.au')
    const listingId = await draft(db)
    const imageId = await uploadFixture(db, listingId, 'car-exterior.jpg')
    await adminDb().from('listing_images').update({ deleted_at: new Date().toISOString() }).eq('id', imageId)
    expect(await processNextJobs(adminDb(), 5, providers)).toMatchObject({ skipped: 1 })
    expect((await adminDb().storage.from('listing-public').list(listingId)).data ?? []).toEqual([])
  })
})

describe('internal routes', () => {
  it('401 without the bearer secret', async () => {
    process.env.INTERNAL_JOB_SECRET = 'ci-internal-job-secret-0123456789abcdef'
    for (const path of ['process-image-checks', 'unpublish-image']) {
      const { POST } = await import(`@/app/api/internal/${path}/route`)
      const res = await POST(new NextRequest(`http://localhost:3000/api/internal/${path}`, { method: 'POST', body: '{}' }))
      expect(res.status).toBe(401)
    }
  })
})
