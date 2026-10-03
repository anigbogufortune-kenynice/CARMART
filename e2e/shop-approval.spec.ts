import { expect, test } from '@playwright/test'
import { createConfirmedUser, e2eAdmin } from './helpers'

test('an admin approves a pending shop and it goes public', async ({ page }) => {
  const owner = await createConfirmedUser(`owner-${Date.now()}@test.local`)
  const slug = `e2e-cars-${Date.now()}`
  const { data: shop } = await e2eAdmin()
    .from('shops')
    .insert({ owner_id: owner.id, name: 'E2E Cars', slug, city: 'Ikeja', state: 'Lagos' })
    .select('id')
    .single()
  await e2eAdmin().from('shops').update({ status: 'pending_approval', submitted_at: new Date().toISOString() }).eq('id', shop!.id)

  expect((await page.goto(`/shops/${slug}`))?.status()).toBe(404)

  await page.goto('/sign-in?next=/admin/shops')
  await page.getByLabel('Email').fill('admin@carmart.local')
  await page.getByLabel('Password').fill('admin-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin/shops', { waitUntil: 'commit' })
  await page.getByRole('button', { name: 'Approve E2E Cars' }).click()
  await expect(page.getByRole('button', { name: 'Approve E2E Cars' })).toBeHidden()

  expect((await page.goto(`/shops/${slug}`))?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'E2E Cars' })).toBeVisible()
})
