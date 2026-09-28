import { expect, test } from '@playwright/test'
import { createConfirmedUser } from './helpers'

async function signIn(page: import('@playwright/test').Page, email: string, password: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`**${next}`, { waitUntil: 'commit' })
}

test('non-admins get a 404 on /admin', async ({ page }) => {
  const user = await createConfirmedUser(`notadmin-${Date.now()}@test.local`)
  await signIn(page, user.email, user.password, '/admin')
  const pageResponse = await page.goto('/admin')
  expect(pageResponse?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible()
  const res = await page.request.get('/api/admin/queues/shops')
  expect(res.status()).toBe(403)
})

test('the seeded admin sees the admin dashboard and shops queue', async ({ page }) => {
  await signIn(page, 'admin@carmart.local', 'admin-password-123', '/admin')
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  await page.getByRole('link', { name: /Shops/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Shops waiting for approval' })).toBeVisible()
})
