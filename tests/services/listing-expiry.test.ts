import { afterEach, describe, expect, it } from 'vitest'
import { renewListing, submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const row = async (id: string) =>
  (await adminDb().from('listings').select('status,version,expires_at,expiry_reminder_sent_at').eq('id', id).single()).data!

async function live(email = 'a@x.ng', cap?: number) {
  const { db, shopId } = await ownerWithShop(email, { cap })
  const id = await completeDraft(db, shopId)
  const r = await submitListing(db, id, 1)
  if (!r.ok || r.value.status !== 'live') throw new Error('not live')
  return { db, shopId, id }
}

describe('expire_listings', () => {
  it('expires live listings past expires_at; in_review never expires', async () => {
    const { db, shopId, id } = await live()
    await adminDb().from('listings').update({ expires_at: ago(1) }).eq('id', id)
    const review = await completeDraft(db, shopId, { other: true })
    await submitListing(db, review, 1)
    await adminDb().from('listings').update({ expires_at: ago(1) }).eq('id', review)
    await adminDb().rpc('expire_listings')
    expect((await row(id)).status).toBe('expired')
    expect((await row(review)).status).toBe('in_review')
  })
})

describe('queue_expiry_reminders', () => {
  it('one listing_expiring per live period', async () => {
    const { id } = await live()
    await adminDb().from('listings').update({ expires_at: ahead(6) }).eq('id', id)
    await adminDb().rpc('queue_expiry_reminders')
    await adminDb().rpc('queue_expiry_reminders')
    const n = (await adminDb().from('notifications').select('kind').eq('ref_id', id).eq('kind', 'listing_expiring')).data ?? []
    expect(n).toHaveLength(1)
    expect((await row(id)).expiry_reminder_sent_at).not.toBeNull()
  })
})

describe('renewListing', () => {
  it('expired → checking with every photo re-queued; when they pass → live for 60 more days, reminder reset', async () => {
    const { db, id } = await live()
    await adminDb().from('listings').update({ expires_at: ago(1), expiry_reminder_sent_at: ago(10) }).eq('id', id)
    await adminDb().rpc('expire_listings')
    const { version } = await row(id)
    const res = await renewListing(db, id, version)
    expect(res).toMatchObject({ ok: true, value: { status: 'checking' } })
    const jobs = (await adminDb().from('image_checks').select('state,image_id,listing_images!inner(listing_id)').eq('listing_images.listing_id', id).eq('state', 'queued')).data ?? []
    expect(jobs).toHaveLength(4)

    await adminDb().from('listing_images').update({ status: 'passed' }).eq('listing_id', id)
    await adminDb().rpc('evaluate_listing', { p_listing_id: id })
    const after = await row(id)
    expect(after.status).toBe('live')
    expect(after.expiry_reminder_sent_at).toBeNull()
    const days = (new Date(after.expires_at!).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(59.9)
  })

  it('a shop at its cap can’t renew; only expired listings can', async () => {
    const { db, shopId, id } = await live('a@x.ng', 1)
    expect(await renewListing(db, id, (await row(id)).version)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
    await adminDb().from('listings').update({ status: 'expired' }).eq('id', id)
    const other = await completeDraft(db, shopId)
    await submitListing(db, other, 1)
    expect(await renewListing(db, id, (await row(id)).version)).toMatchObject({ ok: false, error: { code: 'LISTING_LIMIT_REACHED' } })
  })
})
