import { afterEach, describe, expect, it } from 'vitest'
import { markSold, submitListing } from '@/services/listing-lifecycle.service'
import { getListingForViewer } from '@/services/search.service'
import { adminDb, anonDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

async function live() {
  const { db, shopId } = await ownerWithShop('a@x.ng')
  const id = await completeDraft(db, shopId)
  const r = await submitListing(db, id, 1)
  if (!r.ok || r.value.status !== 'live') throw new Error('not live')
  return { db, shopId, id, version: r.value.version }
}

describe('markSold', () => {
  it('live → sold with sold_at, version+1', async () => {
    const { db, id, version } = await live()
    const res = await markSold(db, id, version)
    expect(res).toMatchObject({ ok: true, value: { status: 'sold', version: version + 1 } })
    expect(res.ok && res.value.sold_at).toBeTruthy()
  })

  it('a draft → INVALID_STATE; a stale version → VERSION_CONFLICT', async () => {
    const { db, shopId } = await ownerWithShop('a@x.ng')
    const draft = await completeDraft(db, shopId)
    expect(await markSold(db, draft, 1)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
    await resetDb()
    const l = await live()
    expect(await markSold(l.db, l.id, l.version - 1)).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } })
  })

  it('sold stays readable by URL for 7 days, then 404', async () => {
    const { db, id, version } = await live()
    await markSold(db, id, version)
    expect(await getListingForViewer(anonDb(), id)).toMatchObject({ ok: true, value: { status: 'sold' } })
    await adminDb().from('listings').update({ sold_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq('id', id)
    expect(await getListingForViewer(anonDb(), id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('unpublish_old_sold() picks up only sold listings past the window that still have public photos', async () => {
    const { db, id, version } = await live()
    await adminDb().from('listing_images').update({ public_paths: { sm: 'a', md: 'b', lg: 'c' } }).eq('listing_id', id)
    await markSold(db, id, version)
    expect((await adminDb().rpc('unpublish_old_sold')).data).toBe(0)
    await adminDb().from('listings').update({ sold_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq('id', id)
    expect((await adminDb().rpc('unpublish_old_sold')).data).toBe(1)
  })
})
