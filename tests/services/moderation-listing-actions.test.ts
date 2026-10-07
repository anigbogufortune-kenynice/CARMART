import { afterEach, describe, expect, it } from 'vitest'
import { submitListing } from '@/services/listing-lifecycle.service'
import { decideListing } from '@/services/moderation.service'
import { completeDraft, ownerWithShop, uniqueVin } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const admin = async () => asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
const listing = async (id: string) => (await adminDb().from('listings').select('status,status_reason,review_flags').eq('id', id).single()).data!
const notices = async (id: string, kind: string) =>
  (await adminDb().from('notifications').select('id,payload').eq('ref_id', id).eq('kind', kind)).data ?? []

/** A live on VIN V (shop a), B held with duplicate_vin (shop b). */
async function duplicatePair() {
  const vin = uniqueVin()
  const a = await ownerWithShop('a@x.ng', { cap: 50 })
  const aId = await completeDraft(a.db, a.shopId, { vin })
  await submitListing(a.db, aId, 1)
  const b = await ownerWithShop('b@x.ng', { cap: 50 })
  const bId = await completeDraft(b.db, b.shopId, { vin })
  await submitListing(b.db, bId, 1)
  return { aId, bId, owner: b.db }
}

describe('decideListing', () => {
  it('clear-flag duplicate_vin is refused while A is live; after removing A, clearing B makes it live', async () => {
    const { aId, bId } = await duplicatePair()
    const staff = await admin()
    expect(await listing(bId)).toMatchObject({ status: 'in_review', review_flags: ['duplicate_vin'] })
    expect(await decideListing(staff, bId, { action: 'clear-flag', flag: 'duplicate_vin' }))
      .toMatchObject({ ok: false, error: { code: 'VIN_STILL_LIVE' } })
    expect(await decideListing(staff, aId, { action: 'remove', reason: 'Stolen photos from another seller' })).toMatchObject({ ok: true })
    expect(await decideListing(staff, bId, { action: 'clear-flag', flag: 'duplicate_vin' })).toMatchObject({ ok: true, value: { status: 'live' } })
    expect(await listing(bId)).toMatchObject({ status: 'live', review_flags: [] })
    const { data: audit } = await adminDb().from('admin_actions').select('action').in('target_id', [aId, bId]).order('created_at')
    expect(audit?.map((r) => r.action)).toEqual(['listing.remove', 'listing.clear_flag'])
  })

  it('reject: in_review → rejected with the reason, flags cleared, one listing_rejected email', async () => {
    const { bId } = await duplicatePair()
    expect(await decideListing(await admin(), bId, { action: 'reject', reason: 'VIN belongs to another car' })).toMatchObject({ ok: true })
    expect(await listing(bId)).toMatchObject({ status: 'rejected', status_reason: 'VIN belongs to another car', review_flags: [] })
    expect(await notices(bId, 'listing_rejected')).toHaveLength(1)
  })

  it('remove: live → removed with a listing_removed email; removing again → INVALID_STATE', async () => {
    const { aId } = await duplicatePair()
    const staff = await admin()
    expect(await decideListing(staff, aId, { action: 'remove', reason: 'Listing breaks our rules' })).toMatchObject({ ok: true, value: { status: 'removed' } })
    expect(await listing(aId)).toMatchObject({ status: 'removed', status_reason: 'Listing breaks our rules' })
    const removed = await notices(aId, 'listing_removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].payload).toMatchObject({ reason: 'Listing breaks our rules', title: '2019 Toyota HiLux' })
    expect(await decideListing(staff, aId, { action: 'remove', reason: 'Listing breaks our rules' }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })

  it('guards: reason required; non-admins FORBIDDEN', async () => {
    const { bId, owner } = await duplicatePair()
    const staff = await admin()
    expect(await decideListing(staff, bId, { action: 'remove', reason: '' })).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await decideListing(staff, bId, { action: 'reject', reason: 'no' })).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await decideListing(owner, bId, { action: 'remove', reason: 'Removing my own' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
