import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { listQueue, setListingCap, setSuspension, type ShopAdminItem } from '@/services/moderation.service'
import { searchListings } from '@/services/search.service'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const admin = async () => asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
const visibleIds = async () => {
  const r = await searchListings(anonDb(), { sort: 'newest', page: 1 })
  return r.ok ? r.value.items.map((c) => c.id) : []
}

async function shopWithTwoLive() {
  const { db, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const ownerId = (await db.auth.getUser()).data.user!.id
  const ids = [await completeDraft(db, shopId), await completeDraft(db, shopId)]
  for (const id of ids) await submitListing(db, id, 1)
  return { db, shopId, ownerId, ids }
}

describe('suspensions', () => {
  it('suspending a shop hides its live listings without changing them; unsuspend shows them again', async () => {
    const { shopId, ids } = await shopWithTwoLive()
    const staff = await admin()
    expect(await visibleIds()).toEqual(expect.arrayContaining(ids))
    expect(await setSuspension(staff, 'shop', shopId, true, 'Selling stolen cars')).toMatchObject({ ok: true })
    expect(await visibleIds()).not.toEqual(expect.arrayContaining([ids[0]]))
    const { data: rows } = await adminDb().from('listings').select('status').in('id', ids)
    expect(rows?.every((r) => r.status === 'live')).toBe(true)
    expect(await setSuspension(staff, 'shop', shopId, false, 'Cleared after checks')).toMatchObject({ ok: true })
    expect(await visibleIds()).toEqual(expect.arrayContaining(ids))
  })

  it('suspending a user suspends their shop; unsuspending the user leaves the shop suspended; OWNER_SUSPENDED guard', async () => {
    const { shopId, ownerId } = await shopWithTwoLive()
    const staff = await admin()
    expect(await setSuspension(staff, 'user', ownerId, true, 'Repeated scam reports')).toMatchObject({ ok: true })
    const status = async () => ({
      profile: (await adminDb().from('profiles').select('status').eq('id', ownerId).single()).data?.status,
      shop: (await adminDb().from('shops').select('status').eq('id', shopId).single()).data?.status,
    })
    expect(await status()).toEqual({ profile: 'suspended', shop: 'suspended' })
    expect(await setSuspension(staff, 'shop', shopId, false, 'Trying to restore')).toMatchObject({ ok: false, error: { code: 'OWNER_SUSPENDED' } })
    expect(await setSuspension(staff, 'user', ownerId, false, 'Appeal accepted')).toMatchObject({ ok: true })
    expect(await status()).toEqual({ profile: 'active', shop: 'suspended' })
    const { data: audit } = await adminDb().from('admin_actions').select('action').eq('target_id', ownerId).order('created_at')
    expect(audit?.map((a) => a.action)).toEqual(['user.suspend', 'user.unsuspend'])
  })

  it('setListingCap: 25 with before/after in the audit; 0 → VALIDATION_ERROR; reason required; non-admin FORBIDDEN', async () => {
    const { db, shopId } = await ownerWithShop('owner@x.ng')
    const staff = await admin()
    expect(await setListingCap(staff, shopId, 25, 'Trusted dealer')).toMatchObject({ ok: true, value: { listing_cap: 25 } })
    const { data: audit } = await adminDb().from('admin_actions').select('action,details').eq('target_id', shopId).single()
    expect(audit).toMatchObject({ action: 'shop.listing_cap', details: { before: 10, after: 25 } })
    expect(await setListingCap(staff, shopId, 0, 'Trusted dealer')).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await setListingCap(staff, shopId, 30, 'no')).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await setListingCap(db, shopId, 30, 'My own shop')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it("listQueue('all-shops', q) searches every shop by name or slug", async () => {
    const { shopId } = await ownerWithShop('owner@x.ng')
    const staff = await admin()
    const res = await listQueue(staff, 'all-shops', 1, { q: 'coastal' })
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.items).toEqual([expect.objectContaining({ id: shopId, name: 'Coastal Cars', listing_cap: 10, owner_status: 'active' }) as ShopAdminItem])
    const none = await listQueue(staff, 'all-shops', 1, { q: 'zzz' })
    expect(none.ok && none.value.items).toEqual([])
  })
})
