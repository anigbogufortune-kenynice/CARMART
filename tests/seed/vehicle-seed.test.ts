import { describe, expect, it } from 'vitest'
import { anonDb } from '../helpers/supabase-test'

describe('vehicle reference data coverage', () => {
  it('has at least 40 makes and 400 models', async () => {
    const db = anonDb()
    const makes = await db.from('vehicle_makes').select('id', { count: 'exact', head: true })
    const models = await db.from('vehicle_models').select('id', { count: 'exact', head: true })
    expect(makes.count ?? 0).toBeGreaterThanOrEqual(40)
    expect(models.count ?? 0).toBeGreaterThanOrEqual(400)
  })

  it('Toyota and Ford carry their core Australian models', async () => {
    const db = anonDb()
    const { data } = await db
      .from('vehicle_models')
      .select('name, make:vehicle_makes!inner(name)')
      .in('make.name', ['Toyota', 'Ford'])
    const names = (data ?? []).map((r) => `${(r.make as unknown as { name: string }).name}:${r.name}`)
    for (const m of ['Toyota:HiLux', 'Toyota:LandCruiser', 'Toyota:Corolla', 'Toyota:RAV4', 'Ford:Ranger']) {
      expect(names).toContain(m)
    }
  })

  it('contains no truck, bus, motorbike, caravan or boat makes', async () => {
    const { data } = await anonDb()
      .from('vehicle_makes')
      .select('name')
      .in('name', ['Kenworth', 'Mack', 'Harley-Davidson', 'Jayco', 'Yamaha'])
    expect(data ?? []).toEqual([])
  })
})
