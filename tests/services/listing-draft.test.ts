import { afterEach, describe, expect, it } from 'vitest'
import { createDraft, deleteDraft, updateDraft } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function owner(email = 'a@x.au') {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0]}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' })
  if (!shop.ok) throw new Error(shop.error.message)
  return { db, shopId: shop.value.id }
}

describe('createDraft', () => {
  it('creates a draft with an uppercase VIN and the shop currency', async () => {
    const { db } = await owner()
    const res = await createDraft(db, { vin: 'jtfst22p900123456' })
    expect(res).toMatchObject({ ok: true, value: { status: 'draft', vin: 'JTFST22P900123456', currency: 'AUD', version: 1 } })
  })

  it('SHOP_NOT_FOUND for a user without a shop', async () => {
    const db = await asUser(await createUser({ email: 'n@x.au' }))
    expect(await createDraft(db, {})).toMatchObject({ ok: false, error: { code: 'SHOP_NOT_FOUND' } })
  })

  it('INVALID_VIN and POSTCODE_STATE_MISMATCH', async () => {
    const { db } = await owner()
    expect(await createDraft(db, { vin: 'BAD' })).toMatchObject({ ok: false, error: { code: 'INVALID_VIN' } })
    expect(await createDraft(db, { state: 'NSW', postcode: '3000' })).toMatchObject({ ok: false, error: { code: 'POSTCODE_STATE_MISMATCH' } })
  })

  it('FORBIDDEN when the shop is suspended', async () => {
    const { db, shopId } = await owner()
    await adminDb().from('shops').update({ status: 'suspended' }).eq('id', shopId)
    expect(await createDraft(db, {})).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})

describe('updateDraft', () => {
  it('updates fields without changing the version', async () => {
    const { db } = await owner()
    const d = await createDraft(db, {})
    if (!d.ok) throw new Error('draft')
    const res = await updateDraft(db, d.value.id, { version: 1, colour: 'Silver', year: 2019 })
    expect(res).toMatchObject({ ok: true, value: { colour: 'Silver', year: 2019, version: 1 } })
  })

  it('checks the postcode against the stored state; VERSION_CONFLICT on a stale version', async () => {
    const { db } = await owner()
    const d = await createDraft(db, { state: 'NSW', postcode: '2150' })
    if (!d.ok) throw new Error('draft')
    expect(await updateDraft(db, d.value.id, { version: 1, postcode: '3000' })).toMatchObject({ ok: false, error: { code: 'POSTCODE_STATE_MISMATCH' } })
    expect(await updateDraft(db, d.value.id, { version: 2, colour: 'Red' })).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } })
  })

  it('INVALID_STATE for a non-draft; NOT_FOUND for someone else’s listing', async () => {
    const { db } = await owner()
    const d = await createDraft(db, {})
    if (!d.ok) throw new Error('draft')
    const other = await owner('b@x.au')
    expect(await updateDraft(other.db, d.value.id, { version: 1, colour: 'Red' })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    await adminDb().from('listings').update({ status: 'in_review', make_other: 'Holden', model_other: 'Kingswood', year: 1975, odometer_km: 1,
      price_cents: 100, body_type: 'sedan', transmission: 'manual', fuel: 'petrol', colour: 'Red', vin: '6H8KZ9A1234567890',
      state: 'NSW', suburb: 'Parramatta', postcode: '2150' }).eq('id', d.value.id)
    expect(await updateDraft(db, d.value.id, { version: 1, colour: 'Blue' })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })
})

describe('deleteDraft', () => {
  it('deletes a draft; a live listing → INVALID_STATE', async () => {
    const { db } = await owner()
    const d = await createDraft(db, {})
    if (!d.ok) throw new Error('draft')
    expect(await deleteDraft(db, d.value.id)).toEqual({ ok: true, value: null })
    expect(await deleteDraft(db, d.value.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })

    const live = await createDraft(db, {})
    if (!live.ok) throw new Error('draft')
    await adminDb().from('listings').update({ status: 'live', make_other: 'Holden', model_other: 'Kingswood', year: 1975, odometer_km: 1,
      price_cents: 100, body_type: 'sedan', transmission: 'manual', fuel: 'petrol', colour: 'Red', vin: '6H8KZ9A1234567890',
      state: 'NSW', suburb: 'Parramatta', postcode: '2150' }).eq('id', live.value.id)
    expect(await deleteDraft(db, live.value.id)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })
})
