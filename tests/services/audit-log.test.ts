import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import {
  decideImage, decideListing, decideReport, decideShop, listAuditLog, listQueue, setListingCap, setSuspension, type ReportQueueItem,
} from '@/services/moderation.service'
import { createReport } from '@/services/report.service'
import { updateSetting } from '@/services/settings.service'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await adminDb().from('app_settings').update({ value: 0.5 }).eq('key', 'ai_review_threshold')
  await resetDb()
})

const staff = async () => asUser(await createUser({ email: 'admin@x.ng', role: 'admin', displayName: 'Admin' }))
const auditCount = async () => (await adminDb().from('admin_actions').select('id', { count: 'exact', head: true })).count ?? 0

async function pendingShop(email: string) {
  const { db, shopId } = await ownerWithShop(email, { approved: false })
  await adminDb().from('shops').update({ status: 'pending_approval', submitted_at: new Date().toISOString() }).eq('id', shopId)
  return { db, shopId }
}

describe('listAuditLog', () => {
  it('newest first with the actor’s name and the target’s name; filters by target', async () => {
    const admin = await staff()
    const { shopId } = await pendingShop('a@x.ng')
    const { db, shopId: other } = await ownerWithShop('b@x.ng', { cap: 50 })
    const listing = await completeDraft(db, other, { photos: 4, photoStatus: 'in_review' })
    const { data: photo } = await adminDb().from('listing_images').select('id').eq('listing_id', listing).eq('position', 0).single()
    await decideShop(admin, shopId, 'approve')
    await decideImage(admin, photo!.id, 'reject', 'Shows a number plate')

    const res = await listAuditLog(admin, {})
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page.size).toBe(50)
    expect(res.value.items.slice(0, 2)).toMatchObject([
      { action: 'image.reject', target_type: 'image', target_id: photo!.id, reason: 'Shows a number plate', actor_name: 'Admin' },
      { action: 'shop.approve', target_type: 'shop', target_id: shopId, actor_name: 'Admin', target_label: 'Coastal Cars' },
    ])
    const shops = await listAuditLog(admin, { target_type: 'shop', target_id: shopId })
    expect(shops.ok && shops.value.items).toHaveLength(1)
    const plain = await asUser(await createUser({ email: 'jo@x.ng' }))
    expect(await listAuditLog(plain, {})).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('every admin action writes exactly one audit row', { timeout: 60_000 }, async () => {
    const admin = await staff()
    const step = async (name: string, action: () => Promise<{ ok: boolean }>) => {
      const before = await auditCount()
      const r = await action()
      expect(r.ok, name).toBe(true)
      expect(await auditCount(), name).toBe(before + 1)
    }
    const a = await pendingShop('a@x.ng')
    const b = await pendingShop('b@x.ng')
    const { db, shopId } = await ownerWithShop('c@x.ng', { cap: 50 })
    const reviewPhotos = await completeDraft(db, shopId, { photos: 2, photoStatus: 'in_review' })
    const { data: photos } = await adminDb().from('listing_images').select('id').eq('listing_id', reviewPhotos).order('position')
    const other = await completeDraft(db, shopId, { other: true })
    await submitListing(db, other, 1)
    const other2 = await completeDraft(db, shopId, { other: true })
    await submitListing(db, other2, 1)
    const live = await completeDraft(db, shopId)
    await submitListing(db, live, 1)
    await createReport(await asUser(await createUser({ email: 'r@x.ng' })), { target_type: 'shop', target_id: shopId, reason: 'scam' })
    const reports = await listQueue(admin, 'reports', 1)
    const reportId = reports.ok ? (reports.value.items[0] as ReportQueueItem).report_id : ''

    await step('shop approve', () => decideShop(admin, a.shopId, 'approve'))
    await step('shop reject', () => decideShop(admin, b.shopId, 'reject', 'Blurry shop name'))
    await step('shop suspend', () => setSuspension(admin, 'shop', a.shopId, true, 'Checking documents'))
    await step('shop unsuspend', () => setSuspension(admin, 'shop', a.shopId, false, 'Documents fine'))
    await step('listing cap', () => setListingCap(admin, a.shopId, 25, 'Trusted dealer'))
    await step('image approve', () => decideImage(admin, photos![0].id, 'approve'))
    await step('image reject', () => decideImage(admin, photos![1].id, 'reject', 'Not this car'))
    await step('listing clear-flag', () => decideListing(admin, other, { action: 'clear-flag', flag: 'other_make_model' }))
    await step('listing reject', () => decideListing(admin, other2, { action: 'reject', reason: 'Make and model are made up' }))
    await step('listing remove', () => decideListing(admin, live, { action: 'remove', reason: 'Breaks the rules' }))
    await step('report dismiss', () => decideReport(admin, reportId, 'dismiss', 'Checked, legit'))
    await step('setting update', () => updateSetting(admin, 'ai_review_threshold', 0.55))
    const user = (await createUser({ email: 'u@x.ng' })).id
    await step('user suspend', () => setSuspension(admin, 'user', user, true, 'Spam account'))

    const { data: rows } = await adminDb().from('admin_actions').select('action,target_type,target_id').order('created_at', { ascending: false }).limit(13)
    for (const r of rows ?? []) {
      expect(r.action.length).toBeGreaterThan(0)
      expect(r.target_type.length).toBeGreaterThan(0)
      expect(r.target_id.length).toBeGreaterThan(0)
    }
  })
})
