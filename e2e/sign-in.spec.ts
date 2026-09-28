import { expect, test } from '@playwright/test'
import { createConfirmedUser } from './helpers'

test('a member signs in, sees their email in the header and signs out', async ({ page }) => {
  const user = await createConfirmedUser(`signin-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/cars')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill('wrong-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Email or password is incorrect')).toBeVisible()

  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/cars', { waitUntil: 'commit' })
  await expect(page.getByRole('banner').getByText(user.email)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL((url) => url.pathname === '/', { waitUntil: 'commit' })
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})
