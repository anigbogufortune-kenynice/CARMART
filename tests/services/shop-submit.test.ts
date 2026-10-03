import { afterEach, describe, expect, it } from 'vitest'
import { sendPhoneCode, verifyPhoneCode } from '@/services/profile.service'
import { createShop, getMyShop, submitMyShop } from '@/services/shop.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const input = { name: 'Coastal Cars', slug: 'coastal-cars', city: 'Ikeja', state: 'Lagos' as const }

async function ownerWithShop(verifyPhone: boolean) {
  const db = await asUser(await createUser({ email: `o${Math.random()}@x.au` }))
  const shop = await createShop(db, input)
  if (verifyPhone) {
    await sendPhoneCode(db, '+2348000000000')
    await verifyPhoneCode(db, '+2348000000000', '123456')
  }
  return { db, id: shop.ok ? shop.value.id : '' }
}

describe('submit_shop (issue 010)', () => {
  it('PHONE_NOT_VERIFIED without a verified phone', async () => {
    const { db } = await ownerWithShop(false)
    expect(await submitMyShop(db)).toMatchObject({ ok: false, error: { code: 'PHONE_NOT_VERIFIED' } })
  })

  it('draft → pending_approval with submitted_at and version 2', async () => {
    const { db, id } = await ownerWithShop(true)
    expect(await submitMyShop(db)).toMatchObject({ ok: true, value: { status: 'pending_approval' } })
    const { data } = await adminDb().from('shops').select('submitted_at,version').eq('id', id).single()
    expect(data?.submitted_at).not.toBeNull()
    expect(data?.version).toBe(2)
  })

  it.each(['pending_approval', 'approved', 'suspended'])('INVALID_STATE from %s', async (status) => {
    const { db, id } = await ownerWithShop(true)
    await adminDb().from('shops').update({ status }).eq('id', id)
    expect(await submitMyShop(db)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })

  it('rejected → pending_approval clears the rejection reason', async () => {
    const { db, id } = await ownerWithShop(true)
    await adminDb().from('shops').update({ status: 'rejected', status_reason: 'Blurry name' }).eq('id', id)
    await submitMyShop(db)
    expect(await getMyShop(db)).toMatchObject({ ok: true, value: { status: 'pending_approval', status_reason: null } })
  })

  it('users without a shop get NOT_FOUND', async () => {
    const db = await asUser(await createUser({ email: 'none@x.au' }))
    expect(await submitMyShop(db)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
