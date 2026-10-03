import { afterEach, describe, expect, it } from 'vitest'
import { decideShop } from '@/services/moderation.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

async function pendingShop() {
  const owner = await createUser({ email: `owner${Math.random()}@x.au` })
  const { data } = await adminDb()
    .from('shops')
    .insert({ owner_id: owner.id, name: 'Coastal Cars', slug: `coastal-${Date.now()}${Math.floor(Math.random() * 1e6)}`, city: 'Ikeja', state: 'Lagos' })
    .select('id,slug')
    .single()
  await adminDb().from('shops').update({ status: 'pending_approval', submitted_at: new Date().toISOString() }).eq('id', data!.id)
  return { owner, id: data!.id as string, slug: data!.slug as string }
}

const audits = async (id: string) =>
  (await adminDb().from('admin_actions').select('action,reason').eq('target_id', id)).data ?? []
const mail = async (userId: string) =>
  (await adminDb().from('notifications').select('kind,payload').eq('user_id', userId)).data ?? []

describe('decideShop (issue 012)', () => {
  it('approve: pending → approved, one audit row, one email, public page visible', async () => {
    const admin = await asUser(await createUser({ email: 'admin@x.au', role: 'admin' }))
    const { owner, id, slug } = await pendingShop()
    expect(await decideShop(admin, id, 'approve')).toMatchObject({ ok: true, value: { status: 'approved' } })
    const { data } = await adminDb().from('shops').select('status,approved_at').eq('id', id).single()
    expect(data?.approved_at).not.toBeNull()
    expect(await audits(id)).toEqual([{ action: 'shop.approve', reason: null }])
    expect(await mail(owner.id)).toEqual([{ kind: 'shop_approved', payload: { shopName: 'Coastal Cars', slug } }])
    expect((await anonDb().from('public_shops').select('slug').eq('id', id)).data).toHaveLength(1)
  })

  it('reject needs a 5–500 character reason, then records it everywhere', async () => {
    const admin = await asUser(await createUser({ email: 'admin@x.au', role: 'admin' }))
    const { owner, id } = await pendingShop()
    expect(await decideShop(admin, id, 'reject', 'no')).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } })
    expect(await decideShop(admin, id, 'reject', 'Name is misleading')).toMatchObject({ ok: true, value: { status: 'rejected' } })
    const { data } = await adminDb().from('shops').select('status_reason').eq('id', id).single()
    expect(data?.status_reason).toBe('Name is misleading')
    expect(await audits(id)).toEqual([{ action: 'shop.reject', reason: 'Name is misleading' }])
    expect(await mail(owner.id)).toMatchObject([{ kind: 'shop_rejected', payload: { reason: 'Name is misleading' } }])
  })

  it('INVALID_STATE for shops that are not pending; FORBIDDEN for non-admins', async () => {
    const admin = await asUser(await createUser({ email: 'admin@x.au', role: 'admin' }))
    const { id } = await pendingShop()
    await decideShop(admin, id, 'approve')
    expect(await decideShop(admin, id, 'approve')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
    const user = await asUser(await createUser({ email: 'u@x.au' }))
    const other = await pendingShop()
    expect(await decideShop(user, other.id, 'approve')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('EC-S3: two admins deciding at once → exactly one wins, one audit row', async () => {
    const a1 = await asUser(await createUser({ email: 'admin1@x.au', role: 'admin' }))
    const a2 = await asUser(await createUser({ email: 'admin2@x.au', role: 'admin' }))
    const { id } = await pendingShop()
    const results = await Promise.all([decideShop(a1, id, 'approve'), decideShop(a2, id, 'reject', 'Duplicate shop')])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.find((r) => !r.ok)).toMatchObject({ error: { code: 'INVALID_STATE' } })
    expect(await audits(id)).toHaveLength(1)
  })
})

describe('internal job wiring (pg_net + Vault)', () => {
  it('invoke_internal_job is a no-op until configured, then queues an HTTP call', async () => {
    expect((await adminDb().rpc('invoke_internal_job', { p_path: '/api/internal/dispatch-notifications' })).data).toBeNull()
    const configured = await adminDb().rpc('configure_internal_jobs', {
      p_base_url: 'http://host.docker.internal:3000',
      p_secret: 'ci-internal-job-secret-0123456789abcdef',
    })
    expect(configured.error).toBeNull()
    const queued = await adminDb().rpc('invoke_internal_job', { p_path: '/api/internal/dispatch-notifications' })
    expect(queued.error).toBeNull()
    expect(typeof queued.data).toBe('number')
  })

  it('configure_internal_jobs is not callable by users', async () => {
    const user = await asUser(await createUser({ email: 'u@x.au' }))
    const res = await user.rpc('configure_internal_jobs', { p_base_url: 'http://evil.example', p_secret: 'x'.repeat(40) })
    expect(res.error).not.toBeNull()
  })
})
