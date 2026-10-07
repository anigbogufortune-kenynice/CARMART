import { expect, test } from '@playwright/test'
import { createConfirmedUser, createLiveListing, signInAs } from './helpers'

test('a buyer filters the search, opens a car, saves it and finds it on Saved', async ({ page }) => {
  test.setTimeout(90_000)
  const city = `Buyertown${Date.now()}`
  const { listingId } = await createLiveListing({ city })
  const buyer = await createConfirmedUser(`buyer-${Date.now()}@test.local`)
  await signInAs(page, buyer.email, buyer.password, '/cars')

  await page.getByLabel('Body type').selectOption('pickup')
  await page.waitForURL(/body_type=pickup/)
  await page.getByLabel('City or area').fill(city)
  await page.getByLabel('City or area').press('Enter')
  await page.waitForURL(new RegExp(`city=${city}`))
  await expect(page.getByRole('heading', { name: '1 car found' })).toBeVisible()
  const card = page.getByRole('link', { name: /2019 Toyota HiLux/ }).first()
  await expect(card).toBeVisible()
  await card.click()
  await page.waitForURL(`**/cars/${listingId}`, { waitUntil: 'commit' })

  const save = page.getByRole('button', { name: 'Save' })
  await save.click()
  await expect(save).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/account/saved')
  await expect(page.getByRole('link', { name: /2019 Toyota HiLux/ })).toHaveCount(1)
})
