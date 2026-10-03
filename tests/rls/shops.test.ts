import { afterEach, describe, expect, it } from 'vitest'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const shop = (ownerId: string, slug = 'coastal-cars') => ({
  owner_id: ownerId, name: 'Coastal Cars', slug, city: 'Ikeja', state: 'Lagos',
})

describe('shops RLS', () => {
  it('owners insert their own draft; other statuses and other owners are refused', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const b = await createUser({ email: 'b@x.au' })
    const db = await asUser(a)
    expect((await db.from('shops').insert(shop(a.id)).select('status').single()).data).toEqual({ status: 'draft' })
    expect((await db.from('shops').insert({ ...shop(a.id, 'x-cars'), status: 'approved' })).error).not.toBeNull()
    expect((await db.from('shops').insert(shop(b.id, 'b-cars'))).error).not.toBeNull()
  })

  it('one shop per owner (unique owner_id)', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const db = await asUser(a)
    await db.from('shops').insert(shop(a.id))
    expect((await db.from('shops').insert(shop(a.id, 'second-shop'))).error?.message).toContain('shops_owner_id_key')
  })

  it('drafts are invisible to anon and other users; approved shops are public', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const b = await createUser({ email: 'b@x.au' })
    const { data } = await (await asUser(a)).from('shops').insert(shop(a.id)).select('id').single()
    expect((await anonDb().from('shops').select('id')).data).toEqual([])
    expect((await (await asUser(b)).from('shops').select('id')).data).toEqual([])
    expect((await (await asUser(a)).from('shops').select('id')).data).toHaveLength(1)
    await adminDb().from('shops').update({ status: 'approved' }).eq('id', data!.id)
    expect((await anonDb().from('shops').select('slug')).data).toEqual([{ slug: 'coastal-cars' }])
  })

  it('owners cannot change status, listing_cap or plan themselves', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const db = await asUser(a)
    const { data } = await db.from('shops').insert(shop(a.id)).select('id').single()
    for (const patch of [{ status: 'approved' }, { listing_cap: 500 }, { plan: 'pro' }]) {
      expect((await db.from('shops').update(patch).eq('id', data!.id)).error?.code).toBe('42501')
    }
  })

  it('current_user_has_shop() reflects ownership', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const db = await asUser(a)
    expect((await db.rpc('current_user_has_shop')).data).toBe(false)
    await db.from('shops').insert(shop(a.id))
    expect((await db.rpc('current_user_has_shop')).data).toBe(true)
  })
})
