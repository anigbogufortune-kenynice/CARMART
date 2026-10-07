import { afterEach, describe, expect, it } from 'vitest'
import { getShopPhone } from '@/services/messaging.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

const PHONE = '+2348031234567'

async function setup() {
  const { db: owner, shopId } = await ownerWithShop('owner@x.ng', { cap: 50 })
  const ownerId = (await owner.auth.getUser()).data.user?.id ?? ''
  await adminDb().from('profiles').update({ phone: PHONE, phone_verified_at: new Date().toISOString() }).eq('id', ownerId)
  const live = await completeDraft(owner, shopId)
  await submitListing(owner, live, 1)
  const draft = await completeDraft(owner, shopId)
  const buyer = await asUser(await createUser({ email: 'jo@x.ng' }))
  return { ownerId, shopId, live, draft, buyer }
}

describe('getShopPhone', () => {
  it('show_phone off → PHONE_NOT_AVAILABLE; on + live → the number; draft → PHONE_NOT_AVAILABLE', async () => {
    const { shopId, live, draft, buyer } = await setup()
    expect(await getShopPhone(buyer, live)).toMatchObject({ ok: false, error: { code: 'PHONE_NOT_AVAILABLE' } })
    await adminDb().from('shops').update({ show_phone: true }).eq('id', shopId)
    expect(await getShopPhone(buyer, live)).toEqual({ ok: true, value: { phone: PHONE } })
    expect(await getShopPhone(buyer, draft)).toMatchObject({ ok: false, error: { code: 'PHONE_NOT_AVAILABLE' } })
  })

  it('an unverified phone is never shown; visitors get UNAUTHENTICATED (so the page can offer sign-in)', async () => {
    const { ownerId, shopId, live, buyer } = await setup()
    await adminDb().from('shops').update({ show_phone: true }).eq('id', shopId)
    expect(await getShopPhone(anonDb(), live)).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
    await adminDb().from('profiles').update({ phone_verified_at: null }).eq('id', ownerId)
    expect(await getShopPhone(buyer, live)).toMatchObject({ ok: false, error: { code: 'PHONE_NOT_AVAILABLE' } })
    expect(await getShopPhone(anonDb(), live)).toMatchObject({ ok: false, error: { code: 'PHONE_NOT_AVAILABLE' } })
  })
})
