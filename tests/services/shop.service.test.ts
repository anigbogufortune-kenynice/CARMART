import { afterEach, describe, expect, it } from 'vitest'
import { getMe } from '@/services/profile.service'
import { createShop, getMyShop } from '@/services/shop.service'
import { asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const input = { name: 'Coastal Cars', slug: 'coastal-cars', suburb: 'Parramatta', state: 'NSW' as const, postcode: '2150' }

describe('shop.service createShop / getMyShop', () => {
  it('creates a draft shop for the caller', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    const res = await createShop(db, input)
    expect(res).toMatchObject({ ok: true, value: { slug: 'coastal-cars', status: 'draft', verified: false, listing_cap: 10 } })
    expect(await getMyShop(db)).toMatchObject({ ok: true, value: { slug: 'coastal-cars' } })
    expect(await getMe(db)).toMatchObject({ ok: true, value: { has_shop: true } })
  })

  it('SHOP_ALREADY_EXISTS for a second shop', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    await createShop(db, input)
    expect(await createShop(db, { ...input, slug: 'another' })).toMatchObject({ ok: false, error: { code: 'SHOP_ALREADY_EXISTS' } })
  })

  it('SLUG_TAKEN when another shop has the slug', async () => {
    await createShop(await asUser(await createUser({ email: 'a@x.au' })), input)
    const db = await asUser(await createUser({ email: 'b@x.au' }))
    expect(await createShop(db, input)).toMatchObject({ ok: false, error: { code: 'SLUG_TAKEN' } })
  })

  it('POSTCODE_STATE_MISMATCH; ACT 2600 accepted', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    expect(await createShop(db, { ...input, postcode: '3000' })).toMatchObject({ ok: false, error: { code: 'POSTCODE_STATE_MISMATCH' } })
    expect(await createShop(db, { ...input, state: 'ACT', postcode: '2600' })).toMatchObject({ ok: true })
  })

  it('getMyShop → NOT_FOUND without a shop', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    expect(await getMyShop(db)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('two concurrent creates with the same slug: exactly one wins', async () => {
    const a = await asUser(await createUser({ email: 'a@x.au' }))
    const b = await asUser(await createUser({ email: 'b@x.au' }))
    const results = await Promise.all([createShop(a, input), createShop(b, input)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.find((r) => !r.ok)).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
  })
})
