import { expect, test } from '@playwright/test'
import { createConfirmedUser } from './helpers'

test('draft API: validation codes, patch and delete', async ({ page }) => {
  const user = await createConfirmedUser(`drafts-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/sell')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/sell'), { waitUntil: 'commit' })
  const api = page.request

  const shop = await api.post('/api/shops', {
    data: { name: 'Draft Motors', slug: `draft-motors-${Date.now()}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' },
  })
  expect(shop.status()).toBe(201)

  const bad = await api.post('/api/listings', { data: { vin: 'BAD' } })
  expect(bad.status()).toBe(422)
  expect((await bad.json()).error.code).toBe('INVALID_VIN')
  expect((await api.post('/api/listings', { data: { body_type: 'truck' } })).status()).toBe(422)

  const created = await api.post('/api/listings', { data: { vin: 'jtfst22p900123456', state: 'NSW', postcode: '2150' } })
  expect(created.status()).toBe(201)
  const draft = (await created.json()).data
  expect(draft).toMatchObject({ status: 'draft', vin: 'JTFST22P900123456' })

  const mismatch = await api.patch(`/api/listings/${draft.id}`, { data: { version: 1, postcode: '3000', state: 'NSW' } })
  expect(mismatch.status()).toBe(422)
  expect((await mismatch.json()).error.code).toBe('POSTCODE_STATE_MISMATCH')

  expect((await api.delete(`/api/listings/${draft.id}`)).status()).toBe(204)
  expect((await api.delete(`/api/listings/${draft.id}`)).status()).toBe(404)
})
