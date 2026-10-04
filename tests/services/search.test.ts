import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { searchListings } from '@/services/search.service'
import { listMakes, listModels } from '@/services/listing.service'
import { adminDb, anonDb, resetDb } from '../helpers/supabase-test'
import { ownerWithShop, uniqueVin } from '../helpers/listing-fixtures'

/** Inserts live listings directly (photos passed) so search can be tested at scale. */
let ids: { toyota: string; hilux: string; honda: string; accord: string }
let liveCount = 0

async function insertLive(shopId: string, fields: Record<string, unknown>) {
  const { data, error } = await adminDb().from('listings').insert({
    shop_id: shopId, make_id: ids.toyota, model_id: ids.hilux, year: 2019, odometer_km: 80_000, price_cents: 1_500_000_000,
    condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel', colour: 'White', vin: uniqueVin(),
    state: 'Lagos', city: 'Ikeja', status: 'live', live_at: new Date(Date.now() - liveCount++ * 60_000).toISOString(),
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), ...fields,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await adminDb().from('listing_images').insert({
    listing_id: data.id, shop_id: shopId, position: 0, quarantine_path: `${shopId}/${data.id}/p0`, mime_type: 'image/jpeg',
    bytes: 1000, status: 'passed', public_paths: { sm: `${data.id}/a-sm.webp`, md: `${data.id}/a-md.webp`, lg: `${data.id}/a-lg.webp` },
  })
  return data.id as string
}

beforeAll(async () => {
  const makes = await listMakes(adminDb())
  if (!makes.ok) throw new Error('makes')
  const toyota = makes.value.find((m) => m.name === 'Toyota')!.id
  const honda = makes.value.find((m) => m.name === 'Honda')!.id
  const tm = await listModels(adminDb(), toyota)
  const hm = await listModels(adminDb(), honda)
  if (!tm.ok || !hm.ok) throw new Error('models')
  ids = { toyota, hilux: tm.value.find((m) => m.name === 'HiLux')!.id, honda, accord: hm.value.find((m) => m.name === 'Accord')!.id }

  const a = await ownerWithShop('a@x.ng')
  const b = await ownerWithShop('b@x.ng')
  const suspended = await ownerWithShop('s@x.ng')
  // 30 visible listings across 2 approved shops.
  for (let i = 0; i < 26; i++) {
    await insertLive(i % 2 ? a.shopId : b.shopId, { price_cents: (1_000_000 + i * 100_000) * 100, year: 2010 + (i % 12), odometer_km: 10_000 * (i + 1) })
  }
  await insertLive(a.shopId, { make_id: ids.honda, model_id: ids.accord, body_type: 'sedan', state: 'FCT', city: 'Wuse', price_cents: 900_000_000 })
  await insertLive(a.shopId, { state: 'Rivers', city: 'Port Harcourt', body_type: 'suv', condition: 'brand_new' })
  await insertLive(b.shopId, { description: 'Clean turbo diesel, one owner', state: 'Rivers', city: 'port harcourt' })
  await insertLive(b.shopId, { state: 'Rivers', body_type: 'pickup', city: 'Bonny' })
  // Not visible: suspended shop, checking, sold.
  await insertLive(suspended.shopId, {})
  await adminDb().from('shops').update({ status: 'suspended' }).eq('id', suspended.shopId)
  await insertLive(a.shopId, { status: 'checking', live_at: null })
  await insertLive(a.shopId, { status: 'sold', sold_at: new Date().toISOString() })
}, 120_000)

afterAll(async () => {
  await resetDb()
})

const search = (q: Record<string, unknown>) => searchListings(anonDb(), { sort: 'newest', page: 1, ...q })

describe('searchListings', () => {
  it('only live listings of approved shops, 24 per page with an accurate total', async () => {
    const res = await search({})
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.page).toEqual({ number: 1, size: 24, total: 30 })
    expect(res.value.items).toHaveLength(24)
    const p2 = await search({ page: 2 })
    expect(p2.ok && p2.value.items).toHaveLength(6)
    const p5 = await search({ page: 5 })
    expect(p5.ok && p5.value).toMatchObject({ items: [], page: { total: 30 } })
  })

  it('each item has a title, thumbnail and shop summary', async () => {
    const res = await search({ make_id: ids.honda })
    if (!res.ok) throw new Error(res.error.message)
    expect(res.value.items).toHaveLength(1)
    expect(res.value.items[0]).toMatchObject({ title: '2019 Honda Accord', state: 'FCT', shop: { name: 'Coastal Cars', verified: false } })
    expect(res.value.items[0].thumbnail_url).toMatch(/listing-public\/.+-sm\.webp$/)
  })

  it('filters combine with AND', async () => {
    const cheap = await search({ price_max: 1_500_000_00 })
    expect(cheap.ok && cheap.value.items.every((i) => (i.price_cents ?? 0) <= 1_500_000_00)).toBe(true)
    const newish = await search({ year_min: 2018, km_max: 100_000 })
    expect(newish.ok && newish.value.items.every((i) => (i.year ?? 0) >= 2018 && (i.odometer_km ?? 0) <= 100_000)).toBe(true)
    const rivers = await search({ state: 'Rivers', body_type: 'pickup' })
    expect(rivers.ok && rivers.value.page.total).toBe(2)
    const city = await search({ city: 'PORT HARCOURT' })
    expect(city.ok && city.value.page.total).toBe(2)
    const brandNew = await search({ condition: 'brand_new' })
    expect(brandNew.ok && brandNew.value.page.total).toBe(1)
  })

  it('q uses full-text search', async () => {
    const res = await search({ q: 'turbo diesel' })
    expect(res.ok && res.value.page.total).toBe(1)
  })

  it('sorts with ties broken by id', async () => {
    const asc = await search({ sort: 'price_asc' })
    if (!asc.ok) throw new Error(asc.error.message)
    const prices = asc.value.items.map((i) => i.price_cents ?? 0)
    expect(prices).toEqual([...prices].sort((x, y) => x - y))
    const km = await search({ sort: 'km_asc' })
    const kms = km.ok ? km.value.items.map((i) => i.odometer_km ?? 0) : []
    expect(kms).toEqual([...kms].sort((x, y) => x - y))
  })
})
