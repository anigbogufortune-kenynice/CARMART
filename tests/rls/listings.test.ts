import { afterEach, describe, expect, it } from 'vitest'
import { createShop } from '@/services/shop.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function ownerWithShop(email: string, slug: string) {
  const user = await createUser({ email })
  const db = await asUser(user)
  const shop = await createShop(db, { name: 'Coastal Cars', slug, city: 'Ikeja', state: 'Lagos' })
  if (!shop.ok) throw new Error(shop.error.message)
  return { db, shopId: shop.value.id }
}

const complete = {
  make_other: 'Holden', model_other: 'Kingswood', year: 1975, odometer_km: 100_000, price_cents: 350_000_000, condition: 'nigerian_used',
  body_type: 'sedan', transmission: 'manual', fuel: 'petrol', colour: 'Red', state: 'Lagos', city: 'Ikeja',
}

describe('listings RLS and constraints', () => {
  it('owner inserts a draft; other users and anon see nothing', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au', 'coastal-cars')
    const ins = await db.from('listings').insert({ shop_id: shopId, vin: 'JTFST22P900123456' }).select('id,status,currency').single()
    expect(ins.error).toBeNull()
    expect(ins.data).toMatchObject({ status: 'draft', currency: 'NGN' })

    const other = await asUser(await createUser({ email: 'b@x.au' }))
    expect((await other.from('listings').select('id')).data ?? []).toHaveLength(0)
    expect((await anonDb().from('listings').select('id')).data ?? []).toHaveLength(0)
  })

  it('a user cannot insert into another shop or set a status', async () => {
    const { shopId } = await ownerWithShop('a@x.au', 'coastal-cars')
    const other = await asUser(await createUser({ email: 'b@x.au' }))
    expect((await other.from('listings').insert({ shop_id: shopId })).error).not.toBeNull()
    const { db, shopId: own } = await ownerWithShop('c@x.au', 'other-shop')
    expect((await db.from('listings').insert({ shop_id: own, status: 'live' })).error).not.toBeNull()
  })

  it('body_type truck is not a valid enum value', async () => {
    const { db, shopId } = await ownerWithShop('a@x.au', 'coastal-cars')
    const res = await db.from('listings').insert({ shop_id: shopId, body_type: 'truck' })
    expect(res.error?.message).toMatch(/invalid input value for enum/)
  })

  it('one live listing per VIN; duplicates allowed while checking', async () => {
    const { shopId } = await ownerWithShop('a@x.au', 'coastal-cars')
    const vin = '6H8KZ9A1234567890'
    const two = await adminDb().from('listings').insert([
      { ...complete, shop_id: shopId, vin, status: 'checking' },
      { ...complete, shop_id: shopId, vin, status: 'checking' },
    ])
    expect(two.error).toBeNull()
    const live = await adminDb().from('listings').insert([
      { ...complete, shop_id: shopId, vin: 'JTFST22P900123456', status: 'live' },
      { ...complete, shop_id: shopId, vin: 'JTFST22P900123456', status: 'live' },
    ])
    expect(live.error?.message).toContain('listings_live_vin_key')
  })

  it('non-draft rows must be complete; the search vector is filled', async () => {
    const { shopId } = await ownerWithShop('a@x.au', 'coastal-cars')
    const bare = await adminDb().from('listings').insert({ shop_id: shopId, status: 'checking' })
    expect(bare.error?.message).toContain('listings_complete_unless_draft')
    await adminDb().from('listings').insert({ ...complete, shop_id: shopId, vin: '6H8KZ9A1234567890', status: 'checking' })
    const hit = await adminDb().from('listings').select('id').textSearch('search_vector', 'kingswood')
    expect(hit.data ?? []).toHaveLength(1)
  })
})
