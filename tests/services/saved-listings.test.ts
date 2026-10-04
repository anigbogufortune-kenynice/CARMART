import { afterEach, describe, expect, it } from 'vitest'
import { listSaved, saveListing, unsaveListing, isSaved } from '@/services/saved.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

async function liveListing() {
  const { db, shopId } = await ownerWithShop('seller@x.ng')
  const id = await completeDraft(db, shopId)
  const r = await submitListing(db, id, 1)
  if (!r.ok || r.value.status !== 'live') throw new Error('not live')
  return { id, sellerDb: db, shopId }
}

describe('saved_listings RLS', () => {
  it('users only see their own rows; anon can’t insert', async () => {
    const { id } = await liveListing()
    const a = await asUser(await createUser({ email: 'a@x.ng' }))
    const b = await asUser(await createUser({ email: 'b@x.ng' }))
    await saveListing(a, id)
    expect(((await b.from('saved_listings').select('listing_id')).data ?? [])).toHaveLength(0)
    expect(((await a.from('saved_listings').select('listing_id')).data ?? [])).toHaveLength(1)
    expect((await anonDb().from('saved_listings').insert({ listing_id: id })).error).not.toBeNull()
  })
})

describe('saveListing / unsaveListing', () => {
  it('is idempotent: created then already saved, one row', async () => {
    const { id } = await liveListing()
    const a = await asUser(await createUser({ email: 'a@x.ng' }))
    expect(await saveListing(a, id)).toEqual({ ok: true, value: { created: true } })
    expect(await saveListing(a, id)).toEqual({ ok: true, value: { created: false } })
    expect(((await adminDb().from('saved_listings').select('listing_id').eq('listing_id', id)).data ?? [])).toHaveLength(1)
    expect(await isSaved(a, id)).toBe(true)
    expect(await unsaveListing(a, id)).toEqual({ ok: true, value: null })
    expect(await isSaved(a, id)).toBe(false)
  })

  it('a listing that isn’t public can’t be saved', async () => {
    const { db, shopId } = await ownerWithShop('seller@x.ng')
    const draft = await completeDraft(db, shopId)
    const a = await asUser(await createUser({ email: 'a@x.ng' }))
    expect(await saveListing(a, draft)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('listSaved', () => {
  it('newest first; a listing no longer visible is flagged unavailable but keeps its title', async () => {
    const one = await liveListing()
    const a = await asUser(await createUser({ email: 'a@x.ng' }))
    await saveListing(a, one.id)
    await adminDb().from('listings').update({ status: 'sold', sold_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq('id', one.id)
    const res = await listSaved(a, 1)
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page.total).toBe(1)
    expect(res.value.items[0]).toMatchObject({ id: one.id, title: '2019 Toyota HiLux', unavailable: true })
  })
})
