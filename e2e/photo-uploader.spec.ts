import { expect, test } from '@playwright/test'
import { createConfirmedUser, markedPhoto, MARKERS, runImageChecks } from './helpers'

test('seller uploads photos and sees each check result', async ({ page }) => {
  const user = await createConfirmedUser(`uploader-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/sell')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/sell'), { waitUntil: 'commit' })
  expect((await page.request.post('/api/shops', {
    data: { name: 'Uploader Motors', slug: `uploader-${Date.now()}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' },
  })).status()).toBe(201)
  const listingId = (await (await page.request.post('/api/listings', { data: {} })).json()).data.id

  await page.goto(`/sell/listings/${listingId}`)
  await expect(page.getByText('0 / 20 photos (min 4)')).toBeVisible()

  await page.getByLabel('Add photos').setInputFiles([
    { name: 'car.jpg', mimeType: 'image/jpeg', buffer: await markedPhoto(MARKERS.carExterior) },
    { name: 'dog.jpg', mimeType: 'image/jpeg', buffer: await markedPhoto(MARKERS.dog) },
  ])
  await expect(page.getByText('2 / 20 photos (min 4)')).toBeVisible({ timeout: 20_000 })
  // pg_net normally wakes the job runner at once; the explicit call covers a missed wake-up.
  await runImageChecks(page.request)
  const photos = page.getByRole('list', { name: 'Photos' })
  await expect(photos.getByText('Passed')).toBeVisible({ timeout: 15_000 })
  await expect(photos.getByText('Rejected')).toBeVisible()
  await expect(photos.getByText("This photo doesn't show a car. Only photos of the car for sale are allowed.")).toBeVisible()

  // Move the passed photo (second, if the dog came first) and check the order persists.
  const firstChip = await photos.getByRole('listitem').first().textContent()
  const target = firstChip?.includes('Passed') ? 'Move photo 1 later' : 'Move photo 2 earlier'
  const saved = page.waitForResponse((r) => r.url().endsWith('/images/order') && r.request().method() === 'PUT')
  await photos.getByRole('button', { name: target }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  const reloadedFirst = await page.getByRole('list', { name: 'Photos' }).getByRole('listitem').first().textContent()
  expect(reloadedFirst?.includes('Passed')).toBe(!firstChip?.includes('Passed'))
})
