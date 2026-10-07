import { expect, test } from '@playwright/test'
import { markedPhoto, MARKERS, runImageChecks, signInAs, signUpAndVerify } from './helpers'

test('a seller signs up, opens a shop, gets approved and their first car goes live', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const email = `seller-${Date.now()}@test.local`
  const seller = await signUpAndVerify(page, email)

  // Create the shop.
  await page.goto('/sell/shop')
  await page.getByLabel('Shop name').fill('Journey Motors')
  await page.getByLabel('Shop web address').fill(`journey-${Date.now()}`)
  await page.getByLabel('City or area').fill('Ikeja')
  await page.getByLabel('State').selectOption('Lagos')
  await page.getByRole('button', { name: 'Create shop' }).click()
  await expect(page.getByRole('link', { name: 'Back to your checklist' })).toBeVisible()

  // Verify the phone with the local test OTP number.
  await page.goto('/sell/phone')
  await page.getByLabel('Mobile number').fill('0800 000 0000')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('heading', { name: 'Phone verified' })).toBeVisible()

  // Submit for approval.
  await page.goto('/sell')
  await page.getByRole('button', { name: 'Submit for approval' }).click()
  await expect(page.getByText('Waiting for approval')).toBeVisible()

  // An admin approves it.
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await signInAs(admin, 'admin@carmart.local', 'admin-password-123', '/admin/shops')
  await admin.getByRole('button', { name: 'Approve Journey Motors' }).click()
  await expect(admin.getByRole('button', { name: 'Approve Journey Motors' })).toBeHidden()
  await adminContext.close()

  // The seller adds a car from the Sell page.
  await page.goto('/sell')
  await page.getByRole('link', { name: 'Add a car' }).click()
  await page.waitForURL('**/sell/listings/new', { waitUntil: 'commit' })
  const makes = (await (await page.request.get('/api/vehicle-makes')).json()).data as { id: string; name: string }[]
  const toyota = makes.find((m) => m.name === 'Toyota')!
  const models = (await (await page.request.get(`/api/vehicle-makes/${toyota.id}/models`)).json()).data as { id: string; name: string }[]
  const draft = await (await page.request.post('/api/listings', {
    data: {
      make_id: toyota.id, make_other: null, model_id: models.find((m) => m.name === 'HiLux')!.id, model_other: null,
      year: 2019, odometer_km: 84000, price_cents: 1850000000, condition: 'foreign_used', body_type: 'pickup',
      transmission: 'automatic', fuel: 'diesel', colour: 'White', vin: `JTFST22P9${String(Date.now()).slice(-8)}`, state: 'Lagos', city: 'Ikeja',
    },
  })).json()
  const id = draft.data.id as string

  await page.goto(`/sell/listings/${id}`)
  const files = await Promise.all([1, 2, 3, 4].map(async (n) => ({ name: `car-${n}.jpg`, mimeType: 'image/jpeg', buffer: await markedPhoto(MARKERS.carExterior) })))
  await page.getByLabel('Add photos').setInputFiles(files)
  await expect(page.getByText('4 / 20 photos (min 4)')).toBeVisible({ timeout: 30_000 })
  await runImageChecks(page.request)
  await expect(page.getByRole('list', { name: 'Photos' }).getByText('Passed')).toHaveCount(4, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Submit listing' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Live since' })).toBeVisible({ timeout: 30_000 })

  // Anyone can open it.
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  expect((await anon.goto(`/cars/${id}`))?.status()).toBe(200)
  await expect(anon.getByRole('heading', { level: 1, name: '2019 Toyota HiLux' })).toBeVisible()
  await visitor.close()
  expect(seller.email).toBe(email)
})
