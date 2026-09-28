import { afterEach, describe, expect, it } from 'vitest'
import { getMe, updateDisplayName } from '@/services/profile.service'
import { asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

describe('profile.service', () => {
  it('getMe returns the caller profile', async () => {
    const u = await createUser({ email: 'jo@x.au' })
    const res = await getMe(await asUser(u))
    expect(res).toEqual({
      ok: true,
      value: { id: u.id, display_name: 'jo', role: 'user', phone: null, phone_verified: false, has_shop: false },
    })
  })

  it('updateDisplayName validates and persists', async () => {
    const u = await createUser({ email: 'jo@x.au' })
    const db = await asUser(u)
    expect(await updateDisplayName(db, '   ')).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateDisplayName(db, 'x'.repeat(61))).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await updateDisplayName(db, '  Jo Buyer ')).toMatchObject({ ok: true, value: { display_name: 'Jo Buyer' } })
    expect(await getMe(db)).toMatchObject({ ok: true, value: { display_name: 'Jo Buyer' } })
  })
})
