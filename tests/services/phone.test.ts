import { afterEach, describe, expect, it } from 'vitest'
import { getMe, sendPhoneCode, verifyPhoneCode } from '@/services/profile.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

const TEST_PHONE = '+61400000000' // supabase/config.toml [auth.sms.test_otp] → 123456

describe('phone verification (issue 009)', () => {
  it('sends a code and verifies it; the profile records the E.164 phone', async () => {
    const db = await asUser(await createUser({ email: 'seller@x.au' }))
    expect(await sendPhoneCode(db, TEST_PHONE)).toEqual({ ok: true, value: { sent: true } })
    expect(await verifyPhoneCode(db, TEST_PHONE, '000000')).toMatchObject({ ok: false, error: { code: 'INVALID_CODE' } })
    expect(await verifyPhoneCode(db, TEST_PHONE, '123456')).toEqual({ ok: true, value: { phone_verified: true } })
    expect(await getMe(db)).toMatchObject({ ok: true, value: { phone: TEST_PHONE, phone_verified: true } })
  })

  it('PHONE_IN_USE when another account already verified the number', async () => {
    const first = await asUser(await createUser({ email: 'a@x.au' }))
    await sendPhoneCode(first, TEST_PHONE)
    await verifyPhoneCode(first, TEST_PHONE, '123456')
    const second = await asUser(await createUser({ email: 'b@x.au' }))
    expect(await sendPhoneCode(second, TEST_PHONE)).toMatchObject({ ok: false, error: { code: 'PHONE_IN_USE' } })
  })

  it('RATE_LIMITED after 5 code requests in an hour', async () => {
    const u = await createUser({ email: 'c@x.au' })
    const rows = Array.from({ length: 5 }, () => ({ user_id: u.id }))
    expect((await adminDb().from('phone_code_requests').insert(rows)).error).toBeNull()
    expect(await sendPhoneCode(await asUser(u), '+61400000001')).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
  })

  it('rejects numbers that are not Australian mobiles', async () => {
    const db = await asUser(await createUser({ email: 'd@x.au' }))
    expect(await sendPhoneCode(db, '+61212345678')).toMatchObject({ ok: false, error: { code: 'INVALID_AU_MOBILE' } })
  })
})
