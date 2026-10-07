import { afterEach, describe, expect, it } from 'vitest'
import { decideShop } from '@/services/moderation.service'
import { ownerWithShop } from '../helpers/listing-fixtures'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

afterEach(async () => {
  await resetDb()
})

describe('admin_actions is append-only', () => {
  it('admins can’t update or delete rows, and neither can the service role', async () => {
    const admin = await asUser(await createUser({ email: 'admin@x.ng', role: 'admin' }))
    const { shopId } = await ownerWithShop('a@x.ng', { approved: false })
    await adminDb().from('shops').update({ status: 'pending_approval' }).eq('id', shopId)
    await decideShop(admin, shopId, 'approve')
    const { data: row } = await adminDb().from('admin_actions').select('id,action').eq('target_id', shopId).single()

    const upd = await admin.from('admin_actions').update({ action: 'tampered' }).eq('id', row!.id).select('id')
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true)
    const del = await admin.from('admin_actions').delete().eq('id', row!.id).select('id')
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true)

    const svcUpdate = await adminDb().from('admin_actions').update({ action: 'tampered' }).eq('id', row!.id)
    expect(svcUpdate.error?.message).toContain('APPEND_ONLY')
    const svcDelete = await adminDb().from('admin_actions').delete().eq('id', row!.id)
    expect(svcDelete.error?.message).toContain('APPEND_ONLY')

    const { data: after } = await adminDb().from('admin_actions').select('action').eq('id', row!.id).single()
    expect(after).toEqual({ action: 'shop.approve' })
  })
})
