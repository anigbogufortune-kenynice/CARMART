import { expect, test } from '@playwright/test'

test.describe('reference data API', () => {
  test('GET /api/vehicle-makes → 200 alphabetical { id, name }', async ({ request }) => {
    const res = await request.get('/api/vehicle-makes')
    expect(res.status()).toBe(200)
    const { data } = await res.json()
    expect(data.length).toBeGreaterThanOrEqual(40)
    expect(Object.keys(data[0]).sort()).toEqual(['id', 'name'])
    const toyota = data.find((m: { name: string }) => m.name === 'Toyota')
    const models = await request.get(`/api/vehicle-makes/${toyota.id}/models`)
    expect(models.status()).toBe(200)
    expect((await models.json()).data.map((m: { name: string }) => m.name)).toContain('HiLux')
  })

  test('malformed make id → 422; unknown make → 404', async ({ request }) => {
    expect((await request.get('/api/vehicle-makes/not-a-uuid/models')).status()).toBe(422)
    expect((await request.get('/api/vehicle-makes/00000000-0000-4000-8000-000000000000/models')).status()).toBe(404)
  })
})
