import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { processNextJobs } from '@/server/jobs/image-verification/pipeline'
import { getSettings, updateSetting } from '@/services/settings.service'
import { draft, providers, seller, uploadFixture, warmStorage } from '../helpers/image-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

const DEFAULTS: Record<string, number> = { ai_review_threshold: 0.5, ai_reject_threshold: 0.9, max_photos: 20, min_photos: 4, listing_expiry_days: 60 }

beforeAll(warmStorage, 150_000)
afterEach(async () => {
  // app_settings is global: put back anything a test changed.
  for (const [key, value] of Object.entries(DEFAULTS)) await adminDb().from('app_settings').update({ value }).eq('key', key)
  await resetDb()
})

const admin = async () => asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))

describe('settings', { timeout: 90_000 }, () => {
  it('validates each key and the relations between them', async () => {
    const staff = await admin()
    expect(await updateSetting(staff, 'ai_review_threshold', 0.95))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR', message: expect.stringContaining('must be below ai_reject_threshold') } })
    expect(await updateSetting(staff, 'listing_expiry_days', 0)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateSetting(staff, 'listing_expiry_days', 2.5)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateSetting(staff, 'max_photos', 25)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateSetting(staff, 'min_photos', 21)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateSetting(staff, 'nope', 1)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('updates with an audit row (before/after); getSettings is typed; non-admins FORBIDDEN', async () => {
    const staff = await admin()
    expect(await updateSetting(staff, 'ai_review_threshold', 0.6)).toEqual({ ok: true, value: { key: 'ai_review_threshold', value: 0.6 } })
    const settings = await getSettings(staff)
    expect(settings.ok && settings.value.ai_review_threshold).toBe(0.6)
    expect(settings.ok && settings.value.daily_report_limit).toBe(10)
    const { data: audit } = await adminDb().from('admin_actions').select('action,details')
      .eq('target_id', 'ai_review_threshold').order('created_at', { ascending: false }).limit(1).single()
    expect(audit).toMatchObject({ action: 'settings.update', details: { before: 0.5, after: 0.6 } })
    const plain = await asUser(await createUser({ email: 'jo@x.ng' }))
    expect(await updateSetting(plain, 'ai_review_threshold', 0.55)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(await getSettings(plain)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('the next processed photo uses the new threshold', async () => {
    expect(await updateSetting(await admin(), 'ai_review_threshold', 0.75)).toMatchObject({ ok: true })
    const { db } = await seller('a@x.ng')
    const photo = await uploadFixture(db, await draft(db), 'borderline-ai.jpg')
    await processNextJobs(adminDb(), 5, providers)
    expect((await adminDb().from('listing_images').select('status').eq('id', photo).single()).data).toEqual({ status: 'passed' })
  })
})
