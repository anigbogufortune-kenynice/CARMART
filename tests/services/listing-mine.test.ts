import { afterEach, describe, expect, it } from 'vitest'
import { createDraft, getMyListing, listMakes, listModels, listMine } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function owner(email = 'a@x.au') {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0]}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' })
  if (!shop.ok) throw new Error(shop.error.message)
  return db
}

async function hilux() {
  const makes = await listMakes(anonDb())
  if (!makes.ok) throw new Error('makes')
  const toyota = makes.value.find((m) => m.name === 'Toyota')!
  const models = await listModels(anonDb(), toyota.id)
  if (!models.ok) throw new Error('models')
  return { make_id: toyota.id, model_id: models.value.find((m) => m.name === 'HiLux')!.id }
}

describe('listMine', () => {
  it('lists the owner’s listings with a computed title, newest first; filters by status', async () => {
    const db = await owner()
    const ids = await hilux()
    await createDraft(db, { ...ids, year: 2019 })
    await createDraft(db, { make_id: null, make_other: 'Holden', model_id: null, model_other: 'Kingswood', year: 1975 })
    const res = await listMine(db, { page: 1 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.items.map((l) => l.title)).toEqual(['1975 Holden Kingswood', '2019 Toyota HiLux'])
    expect(res.value.page).toEqual({ number: 1, size: 24, total: 2 })
    const live = await listMine(db, { page: 1, status: 'live' })
    expect(live).toMatchObject({ ok: true, value: { items: [], page: { total: 0 } } })
  })

  it('an empty draft gets a placeholder title; other owners’ listings are not included', async () => {
    const db = await owner()
    await createDraft(db, {})
    const other = await owner('b@x.au')
    await createDraft(other, { year: 2020 })
    const res = await listMine(db, { page: 1 })
    expect(res).toMatchObject({ ok: true, value: { items: [{ title: 'Untitled car' }], page: { total: 1 } } })
  })

  it('SHOP_NOT_FOUND without a shop', async () => {
    const db = await asUser(await createUser({ email: 'n@x.au' }))
    expect(await listMine(db, { page: 1 })).toMatchObject({ ok: false, error: { code: 'SHOP_NOT_FOUND' } })
  })
})

describe('getMyListing', () => {
  it('returns the owner’s listing with its title; NOT_FOUND for others', async () => {
    const db = await owner()
    const d = await createDraft(db, { ...(await hilux()), year: 2019 })
    if (!d.ok) throw new Error('draft')
    expect(await getMyListing(db, d.value.id)).toMatchObject({ ok: true, value: { id: d.value.id, title: '2019 Toyota HiLux' } })
    expect(await getMyListing(await owner('b@x.au'), d.value.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
