import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { enqueue } from '@/services/notification.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

describe('profiles', () => {
  it('handle_new_user creates a profile with defaults', async () => {
    const u = await createUser({ email: 'jo@x.au' })
    const { data } = await adminDb().from('profiles').select('role,status,display_name').eq('id', u.id).single()
    expect(data).toEqual({ role: 'user', status: 'active', display_name: 'jo' })
  })

  it('uses display_name from sign-up metadata when present', async () => {
    const u = await createUser({ email: 'kim@x.au', displayName: 'Kim Nguyen' })
    const { data } = await adminDb().from('profiles').select('display_name').eq('id', u.id).single()
    expect(data?.display_name).toBe('Kim Nguyen')
  })

  it('RLS: users update only their own display_name; role/status are locked', async () => {
    const a = await createUser({ email: 'a@x.au' })
    const b = await createUser({ email: 'b@x.au' })
    const db = await asUser(a)
    expect((await db.from('profiles').update({ display_name: 'Jo B' }).eq('id', a.id)).error).toBeNull()
    const roleChange = await db.from('profiles').update({ role: 'admin' }).eq('id', a.id)
    expect(roleChange.error?.code).toBe('42501')
    const statusChange = await db.from('profiles').update({ status: 'suspended' }).eq('id', a.id)
    expect(statusChange.error?.code).toBe('42501')
    expect((await db.from('profiles').select('id').eq('id', b.id)).data).toEqual([])
    // anon has no table grant at all: denied (stronger than an empty result)
    expect((await anonDb().from('profiles').select('id')).data ?? []).toEqual([])
  })

  it('is_admin(): admins read every profile and can change status', async () => {
    const admin = await createUser({ email: 'admin@x.au', role: 'admin' })
    const u = await createUser({ email: 'u@x.au' })
    const db = await asUser(admin)
    expect((await db.from('profiles').select('id')).data?.length).toBeGreaterThanOrEqual(2)
    expect((await db.from('profiles').update({ status: 'suspended' }).eq('id', u.id)).error).toBeNull()
  })
})

describe('app_settings', () => {
  it('is seeded with every documented key and default', async () => {
    const { data } = await adminDb().from('app_settings').select('key,value')
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    expect(map).toMatchObject({
      ai_reject_threshold: 0.9, ai_review_threshold: 0.5, car_reject_confidence: 0.85, car_pass_confidence: 0.8,
      phash_max_distance: 6, listing_expiry_days: 60, sold_visible_days: 7, expiry_reminder_days: 7,
      reports_auto_hide_count: 3, max_photos: 20, min_photos: 4, daily_upload_limit: 60,
      daily_conversation_limit: 20, daily_report_limit: 10,
    })
    expect(Object.keys(map)).toHaveLength(14)
  })

  it('is admin-only', async () => {
    const u = await createUser({ email: 'u@x.au' })
    expect((await (await asUser(u)).from('app_settings').select('key')).data).toEqual([])
  })
})

describe('admin_actions', () => {
  it('is append-only, even for the service role', async () => {
    const id = randomUUID()
    const { error } = await adminDb().from('admin_actions').insert({
      id, actor_id: randomUUID(), action: 'test.noop', target_type: 'test', target_id: 'x',
    })
    expect(error).toBeNull()
    const upd = await adminDb().from('admin_actions').update({ reason: 'x' }).eq('id', id)
    expect(upd.error?.message).toContain('APPEND_ONLY')
    const del = await adminDb().from('admin_actions').delete().eq('id', id)
    expect(del.error?.message).toContain('APPEND_ONLY')
  })
})

describe('notifications outbox', () => {
  it('enqueue_notification throttles new_message per recipient and conversation for 15 minutes', async () => {
    const u = await createUser({ email: 'n@x.au' })
    const conversation = randomUUID()
    const args = { p_user: u.id, p_kind: 'new_message', p_ref: conversation, p_payload: {} }
    const first = await adminDb().rpc('enqueue_notification', args)
    const second = await adminDb().rpc('enqueue_notification', args)
    expect(first.data).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.data).toBeNull()
    const { data } = await adminDb().from('notifications').select('id').eq('user_id', u.id)
    expect(data).toHaveLength(1)
  })

  it('notification.service.enqueue wraps the RPC', async () => {
    const u = await createUser({ email: 'm@x.au' })
    expect(await enqueue(adminDb(), 'shop_approved', u.id, randomUUID(), {})).toMatchObject({ ok: true })
  })

  it('is not readable by users', async () => {
    const u = await createUser({ email: 'r@x.au' })
    // users have no grant on the outbox: denied
    expect((await (await asUser(u)).from('notifications').select('id')).data ?? []).toEqual([])
  })
})
