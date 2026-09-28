import { afterEach, describe, expect, it } from 'vitest'
import { getMe } from '@/services/profile.service'
import { createShop, getMyShop, getPublicShopBySlug, updateMyShop } from '@/services/shop.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

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

describe('shop.service updateMyShop / getPublicShopBySlug (issue 008)', () => {
  it('updates editable fields', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    await createShop(db, input)
    expect(await updateMyShop(db, { name: 'Coastal Cars NSW', description: 'Family run' })).toMatchObject({
      ok: true, value: { name: 'Coastal Cars NSW', description: 'Family run' },
    })
  })

  it('SLUG_LOCKED once submitted, or after the first approval', async () => {
    const owner = await createUser({ email: 'a@x.au' })
    const db = await asUser(owner)
    const created = await createShop(db, input)
    const id = created.ok ? created.value.id : ''
    expect(await updateMyShop(db, { slug: 'renamed-ok' })).toMatchObject({ ok: true, value: { slug: 'renamed-ok' } })
    await adminDb().from('shops').update({ status: 'pending_approval' }).eq('id', id)
    expect(await updateMyShop(db, { slug: 'new-slug' })).toMatchObject({ ok: false, error: { code: 'SLUG_LOCKED' } })
    await adminDb().from('shops').update({ status: 'rejected', approved_at: new Date().toISOString() }).eq('id', id)
    expect(await updateMyShop(db, { slug: 'new-slug' })).toMatchObject({ ok: false, error: { code: 'SLUG_LOCKED' } })
  })

  it('POSTCODE_STATE_MISMATCH on edit', async () => {
    const db = await asUser(await createUser({ email: 'a@x.au' }))
    await createShop(db, input)
    expect(await updateMyShop(db, { postcode: '3000' })).toMatchObject({ ok: false, error: { code: 'POSTCODE_STATE_MISMATCH' } })
  })

  it('public view: drafts are NOT_FOUND; approved shops expose no private fields', async () => {
    const owner = await createUser({ email: 'a@x.au' })
    const created = await createShop(await asUser(owner), input)
    const id = created.ok ? created.value.id : ''
    expect(await getPublicShopBySlug(anonDb(), 'coastal-cars')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })

    await adminDb().from('shops').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id)
    const unverified = await getPublicShopBySlug(anonDb(), 'coastal-cars')
    expect(unverified).toMatchObject({ ok: true, value: { name: 'Coastal Cars', verified: false } })

    await adminDb().from('profiles').update({ phone: '+61400000000', phone_verified_at: new Date().toISOString() }).eq('id', owner.id)
    const verified = await getPublicShopBySlug(anonDb(), 'coastal-cars')
    expect(verified).toMatchObject({ ok: true, value: { verified: true } })
    const keys = verified.ok ? Object.keys(verified.value) : []
    for (const privateKey of ['status_reason', 'listing_cap', 'owner_id', 'phone', 'show_phone']) expect(keys).not.toContain(privateKey)
  })
})
