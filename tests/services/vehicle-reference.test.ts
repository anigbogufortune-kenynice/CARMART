import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { listMakes, listModels } from '@/services/listing.service'
import { adminDb, anonDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

describe('vehicle_makes / vehicle_models RLS', () => {
  it('anon can read; a user cannot insert; an admin can', async () => {
    const { data } = await anonDb().from('vehicle_makes').select('name').limit(1)
    expect((data ?? []).length).toBe(1)

    const user = await asUser(await createUser({ email: 'u@x.au' }))
    const denied = await user.from('vehicle_makes').insert({ name: 'Zzz Test Make' })
    expect(denied.error).not.toBeNull()

    const admin = await asUser(await createUser({ email: 'boss@x.au', role: 'admin' }))
    const allowed = await admin.from('vehicle_makes').insert({ name: 'Zzz Test Make' }).select('id').single()
    expect(allowed.error).toBeNull()
    await adminDb().from('vehicle_makes').delete().eq('name', 'Zzz Test Make')
    await resetDb()
  })
})

describe('listing.service listMakes / listModels', () => {
  it('listMakes returns active makes alphabetically', async () => {
    const res = await listMakes(anonDb())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value[0].name).toBe('Acura')
    const names = res.value.map((m) => m.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(Object.keys(res.value[0]).sort()).toEqual(['id', 'name'])
  })

  it('listModels returns the make’s models alphabetically; unknown make → NOT_FOUND', async () => {
    const makes = await listMakes(anonDb())
    if (!makes.ok) throw new Error('listMakes failed')
    const toyota = makes.value.find((m) => m.name === 'Toyota')!
    const res = await listModels(anonDb(), toyota.id)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const names = res.value.map((m) => m.name)
    expect(names).toContain('HiLux')
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(await listModels(anonDb(), randomUUID())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
