import { afterAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, asUser, createUser, resetDb } from './helpers/supabase-test'

describe('integration harness', () => {
  afterAll(async () => {
    await resetDb()
  })

  it('reaches the local stack with both anon and service-role clients', async () => {
    expect((await anonDb().auth.getSession()).data.session).toBeNull()
    expect((await adminDb().auth.admin.listUsers()).error).toBeNull()
  })

  it('createUser + asUser sign in as that user', async () => {
    const u = await createUser({ email: 'a@test.local', verified: true })
    expect(u).toMatchObject({ email: 'a@test.local' })
    const client = await asUser(u)
    expect((await client.auth.getUser()).data.user?.id).toBe(u.id)
  })

  it('createUser({ verified: false }) leaves the email unconfirmed', async () => {
    const u = await createUser({ email: 'b@test.local', verified: false })
    const { data } = await adminDb().auth.admin.getUserById(u.id)
    expect(data.user?.email_confirmed_at ?? null).toBeNull()
  })

  it('resetDb removes every auth user', async () => {
    await createUser({ email: 'c@test.local', verified: true })
    await resetDb()
    const { data } = await adminDb().auth.admin.listUsers()
    expect(data.users).toHaveLength(0)
  })
})
