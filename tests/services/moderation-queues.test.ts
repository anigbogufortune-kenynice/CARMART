import { afterEach, describe, expect, it } from 'vitest'
import { listQueue } from '@/services/moderation.service'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function pendingShop(email: string, slug: string, submittedAt: string) {
  const owner = await createUser({ email, displayName: `Owner ${slug}` })
  const { data } = await adminDb()
    .from('shops')
    .insert({ owner_id: owner.id, name: `Shop ${slug}`, slug, suburb: 'Parramatta', state: 'NSW', postcode: '2150' })
    .select('id')
    .single()
  await adminDb().from('shops').update({ status: 'pending_approval', submitted_at: submittedAt }).eq('id', data!.id)
  return data!.id as string
}

describe('moderation.service listQueue("shops")', () => {
  it('lists pending shops oldest first with owner context', async () => {
    const t3 = await pendingShop('c@x.au', 'shop-c', '2026-09-28T03:00:00Z')
    const t1 = await pendingShop('a@x.au', 'shop-a', '2026-09-28T01:00:00Z')
    const t2 = await pendingShop('b@x.au', 'shop-b', '2026-09-28T02:00:00Z')
    const draftOwner = await createUser({ email: 'd@x.au' })
    await adminDb().from('shops').insert({ owner_id: draftOwner.id, name: 'Draft', slug: 'draft-shop', suburb: 'Parramatta', state: 'NSW', postcode: '2150' })

    const admin = await asUser(await createUser({ email: 'admin@x.au', role: 'admin' }))
    const res = await listQueue(admin, 'shops', 1)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect((res.value.items as { id: string }[]).map((i) => i.id)).toEqual([t1, t2, t3])
    expect(res.value.page).toEqual({ number: 1, size: 24, total: 3 })
    expect(res.value.items[0]).toMatchObject({ name: 'Shop shop-a', owner_name: 'Owner shop-a', phone_verified: false })
  })

  it('FORBIDDEN for non-admins', async () => {
    const user = await asUser(await createUser({ email: 'u@x.au' }))
    expect(await listQueue(user, 'shops', 1)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('NOT_FOUND for unknown queues', async () => {
    const admin = await asUser(await createUser({ email: 'admin@x.au', role: 'admin' }))
    expect(await listQueue(admin, 'bogus' as never, 1)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
