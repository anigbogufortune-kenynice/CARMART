import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dispatchPending, type SentEmail } from '@/server/jobs/notification-dispatch/dispatch'
import { adminDb, createUser, resetDb } from '../helpers/supabase-test'

let outbox: SentEmail[] = []
const recorder = { send: async (m: SentEmail) => { outbox.push(m) } }

beforeEach(() => {
  outbox = []
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
})
afterEach(async () => {
  await resetDb()
})

async function enqueue(userId: string, kind: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await adminDb().rpc('enqueue_notification', { p_user: userId, p_kind: kind, p_ref: randomUUID(), p_payload: payload })
  if (error) throw error
  return data as string
}

describe('dispatchPending', () => {
  it('sends known kinds, skips unknown kinds, and records status', async () => {
    const u = await createUser({ email: 'owner@x.au' })
    const a = await enqueue(u.id, 'shop_approved', { shopName: 'Coastal Cars', slug: 'coastal-cars' })
    const b = await enqueue(u.id, 'shop_rejected', { shopName: 'Coastal Cars', reason: 'Name misleading' })
    const c = await enqueue(u.id, 'bogus')

    expect(await dispatchPending(adminDb(), 50, recorder)).toEqual({ sent: 2, skipped: 1, failed: 0, retrying: 0 })
    expect(outbox.map((m) => m.to)).toEqual(['owner@x.au', 'owner@x.au'])

    const { data } = await adminDb().from('notifications').select('id,status,sent_at').in('id', [a, b, c])
    const byId = Object.fromEntries((data ?? []).map((r) => [r.id, r]))
    expect(byId[a].status).toBe('sent')
    expect(byId[a].sent_at).not.toBeNull()
    expect(byId[b].status).toBe('sent')
    expect(byId[c].status).toBe('skipped')
  })

  it('keeps a failed send pending for retry, then marks it failed after 5 attempts', async () => {
    const u = await createUser({ email: 'owner@x.au' })
    const id = await enqueue(u.id, 'shop_approved', { shopName: 'X', slug: 'x' })
    const broken = { send: async () => { throw new Error('SMTP down') } }

    expect(await dispatchPending(adminDb(), 50, broken)).toMatchObject({ retrying: 1 })
    let row = (await adminDb().from('notifications').select('status,attempts,last_error').eq('id', id).single()).data
    expect(row).toMatchObject({ status: 'pending', attempts: 1 })
    expect(row?.last_error).toContain('SMTP down')

    for (let i = 0; i < 4; i++) await dispatchPending(adminDb(), 50, broken)
    row = (await adminDb().from('notifications').select('status,attempts,last_error').eq('id', id).single()).data
    expect(row).toMatchObject({ status: 'failed', attempts: 5 })
  })

  it('never sends the same email twice when two dispatchers run at once', async () => {
    const u = await createUser({ email: 'owner@x.au' })
    for (let i = 0; i < 6; i++) await enqueue(u.id, 'shop_approved', { shopName: `S${i}`, slug: `s${i}` })
    await Promise.all([dispatchPending(adminDb(), 50, recorder), dispatchPending(adminDb(), 50, recorder)])
    expect(outbox).toHaveLength(6)
  })
})
