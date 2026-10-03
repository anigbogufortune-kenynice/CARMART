import { expect, test } from '@playwright/test'
import { createConfirmedUser, e2eAdmin, markedPhoto, MARKERS, runImageChecks } from './helpers'

test('a complete listing with four passing photos goes live on submit', async ({ page }) => {
  test.setTimeout(90_000)
  const user = await createConfirmedUser(`golive-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/sell')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/sell'), { waitUntil: 'commit' })
  const shop = await (await page.request.post('/api/shops', {
    data: { name: 'Live Motors', slug: `live-${Date.now()}`, city: 'Wuse', state: 'FCT' },
  })).json()
  await e2eAdmin().from('shops').update({ status: 'approved' }).eq('id', shop.data.id)

  const makes = (await (await page.request.get('/api/vehicle-makes')).json()).data as { id: string; name: string }[]
  const toyota = makes.find((m) => m.name === 'Toyota')!
  const models = (await (await page.request.get(`/api/vehicle-makes/${toyota.id}/models`)).json()).data as { id: string; name: string }[]
  const vin = `JTFST22P9${String(Date.now()).slice(-8)}`
  const draft = await (await page.request.post('/api/listings', {
    data: {
      make_id: toyota.id, make_other: null, model_id: models.find((m) => m.name === 'HiLux')!.id, model_other: null,
      year: 2019, odometer_km: 84000, price_cents: 1850000000, condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel',
      colour: 'White', vin, state: 'FCT', city: 'Wuse',
    },
  })).json()

  await page.goto(`/sell/listings/${draft.data.id}`)
  await expect(page.getByText('Add at least 4 photos (you have 0)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit listing' })).toBeDisabled()

  const files = await Promise.all([1, 2, 3, 4].map(async (n) => ({ name: `car-${n}.jpg`, mimeType: 'image/jpeg', buffer: await markedPhoto(MARKERS.carExterior) })))
  await page.getByLabel('Add photos').setInputFiles(files)
  await expect(page.getByText('4 / 20 photos (min 4)')).toBeVisible({ timeout: 30_000 })
  await runImageChecks(page.request)
  await expect(page.getByRole('list', { name: 'Photos' }).getByText('Passed')).toHaveCount(4, { timeout: 30_000 })

  const submit = page.getByRole('button', { name: 'Submit listing' })
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()
  await expect(page.getByRole('status').filter({ hasText: 'Live since' })).toBeVisible({ timeout: 15_000 })
})
