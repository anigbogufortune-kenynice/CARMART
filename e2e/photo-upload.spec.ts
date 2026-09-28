import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { createConfirmedUser } from './helpers'

const PHOTO = readFileSync('tests/fixtures/images/car-exterior.jpg')

async function sellerWithDraft(page: Page, tag: string) {
  const user = await createConfirmedUser(`${tag}-${Date.now()}@test.local`)
  await page.goto('/sign-in?next=/sell')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/sell'), { waitUntil: 'commit' })
  const shop = await page.request.post('/api/shops', {
    data: { name: 'Photo Motors', slug: `${tag}-${Date.now()}`, suburb: 'Parramatta', state: 'NSW', postcode: '2150' },
  })
  expect(shop.status()).toBe(201)
  const draft = await page.request.post('/api/listings', { data: {} })
  return (await draft.json()).data.id as string
}

test('photo upload API: request, upload, complete, status, delete', async ({ page, browser }) => {
  const listingId = await sellerWithDraft(page, 'photos')
  const api = page.request

  const req = await api.post(`/api/listings/${listingId}/images`, { data: { mime_type: 'image/jpeg', bytes: PHOTO.length } })
  expect(req.status()).toBe(201)
  const { image_id, upload_url } = (await req.json()).data

  expect((await api.post(`/api/listings/${listingId}/images/${image_id}/complete`)).status()).toBe(409)
  const put = await api.put(upload_url, { data: PHOTO, headers: { 'content-type': 'image/jpeg' } })
  expect(put.ok()).toBe(true)
  const done = await api.post(`/api/listings/${listingId}/images/${image_id}/complete`)
  expect(done.status()).toBe(202)
  expect((await done.json()).data).toEqual({ image_id, status: 'checking' })

  const status = await (await api.get(`/api/listings/${listingId}/images/status`)).json()
  expect(status.data).toMatchObject([{ image_id, position: 0, status: 'checking' }])

  const otherPage = await (await browser.newContext()).newPage()
  await sellerWithDraft(otherPage, 'intruder')
  const foreign = await otherPage.request.post(`/api/listings/${listingId}/images`, { data: { mime_type: 'image/jpeg', bytes: 10 } })
  expect(foreign.status()).toBe(404)

  expect((await api.post(`/api/listings/${listingId}/images`, { data: { mime_type: 'image/gif', bytes: 10 } })).status()).toBe(422)
  expect((await api.delete(`/api/listings/${listingId}/images/${image_id}`)).status()).toBe(204)
})
