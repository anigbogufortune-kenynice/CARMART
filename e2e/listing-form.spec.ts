import { expect, test } from '@playwright/test'
import { createConfirmedUser } from './helpers'

test('seller creates a draft through the listing form', async ({ page }) => {
  const user = await createConfirmedUser(`form-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/sell')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/sell'), { waitUntil: 'commit' })
  const shop = await page.request.post('/api/shops', {
    data: { name: 'Form Motors', slug: `form-motors-${Date.now()}`, suburb: 'Toowoomba', state: 'QLD', postcode: '4350' },
  })
  expect(shop.status()).toBe(201)

  await page.goto('/sell/listings')
  await expect(page.getByText('No cars listed yet')).toBeVisible()
  await page.getByRole('link', { name: 'New listing' }).click()
  await page.waitForURL('**/sell/listings/new', { waitUntil: 'commit' })

  const make = page.getByLabel('Make')
  await expect(make.locator('option', { hasText: 'Toyota' })).toHaveCount(1)
  await make.selectOption({ label: 'Toyota' })
  await expect(page.getByLabel('Model')).toBeEnabled()
  await page.getByLabel('Model').selectOption({ label: 'HiLux' })
  await page.getByLabel('Year').fill('2019')
  await page.getByLabel('Price (AUD)').fill('45,990')
  await page.getByLabel('VIN').fill('jtfst22p9001234o6')
  await expect(page.getByLabel('VIN')).toHaveValue('JTFST22P9001234O6')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Enter a valid 17-character VIN')).toBeVisible()

  await page.getByLabel('VIN').fill('JTFST22P900123456')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.waitForURL(/\/sell\/listings\/[0-9a-f-]{36}$/, { waitUntil: 'commit' })
  await expect(page.getByRole('heading', { name: '2019 Toyota HiLux' })).toBeVisible()
  await expect(page.getByLabel('Price (AUD)')).toHaveValue('45,990')

  await page.goto('/sell/listings')
  const row = page.getByRole('row', { name: /2019 Toyota HiLux/ })
  await expect(row).toContainText('Draft')
  await expect(row).toContainText('$45,990')
})
