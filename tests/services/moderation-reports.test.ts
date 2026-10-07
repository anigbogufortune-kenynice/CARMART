import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { decideReport, listQueue, type ReportQueueItem } from '@/services/moderation.service'
import { createReport } from '@/services/report.service'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const user = async (n: string) => asUser(await createUser({ email: `${n}@x.ng` }))

async function reported() {
  const { db, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const id = await completeDraft(db, shopId)
  await submitListing(db, id, 1)
  await createReport(await user('a'), { target_type: 'listing', target_id: id, reason: 'scam', note: 'Asked for a deposit' })
  await createReport(await user('b'), { target_type: 'listing', target_id: id, reason: 'ai_or_fake_photos' })
  await createReport(await user('c'), { target_type: 'listing', target_id: id, reason: 'scam' })
  await createReport(await user('d'), { target_type: 'shop', target_id: shopId, reason: 'other' })
  const admin = await asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
  return { id, shopId, admin }
}

describe('reports queue', () => {
  it('groups open reports by target, oldest first, with context', async () => {
    const { id, shopId, admin } = await reported()
    const res = await listQueue(admin, 'reports', 1)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page.total).toBe(2)
    const [first, second] = res.value.items as ReportQueueItem[]
    expect(first).toMatchObject({ target_type: 'listing', target_id: id, count: 3, notes: ['Asked for a deposit'] })
    expect([...first.reasons].sort()).toEqual(['ai_or_fake_photos', 'scam'])
    expect(first.listing).toMatchObject({ title: '2019 Toyota HiLux', status: 'in_review', shop_name: 'Coastal Cars' })
    expect(first.listing?.review_flags).toContain('reports_threshold')
    expect(second).toMatchObject({ target_type: 'shop', target_id: shopId, count: 1, shop: { name: 'Coastal Cars' } })
    expect(await listQueue(admin, 'reports', 1, { countOnly: true })).toMatchObject({ ok: true, value: { page: { total: 2 } } })
  })

  it('dismiss closes every open report on the target with audit rows; the listing stays held', async () => {
    const { id, admin } = await reported()
    const res = await listQueue(admin, 'reports', 1)
    if (!res.ok) throw new Error(res.error.message)
    const item = res.value.items[0] as ReportQueueItem
    expect(await decideReport(admin, item.report_id, 'dismiss', 'Checked, legit')).toEqual({ ok: true, value: { closed: 3 } })

    const { data: rows } = await adminDb().from('reports').select('id,status,resolved_by,resolution_note').eq('target_id', id)
    const { data: me } = await admin.auth.getUser()
    expect(rows).toHaveLength(3)
    for (const r of rows ?? []) expect(r).toMatchObject({ status: 'dismissed', resolved_by: me.user!.id, resolution_note: 'Checked, legit' })
    // admin_actions is append-only across the run: look only at this target's reports.
    const { data: audit } = await adminDb().from('admin_actions').select('action').eq('target_type', 'report').in('target_id', (rows ?? []).map((r) => r.id))
    expect(audit?.filter((a) => a.action === 'report.dismiss')).toHaveLength(3)
    expect((await adminDb().from('listings').select('status').eq('id', id).single()).data).toEqual({ status: 'in_review' })
    expect(await decideReport(admin, item.report_id, 'action', 'Again')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })

  it('reason required; non-admins FORBIDDEN', async () => {
    const { admin } = await reported()
    const res = await listQueue(admin, 'reports', 1)
    const item = (res.ok ? res.value.items[0] : null) as ReportQueueItem
    expect(await decideReport(admin, item.report_id, 'dismiss', '')).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await decideReport(await user('z'), item.report_id, 'dismiss', 'Not my call')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
