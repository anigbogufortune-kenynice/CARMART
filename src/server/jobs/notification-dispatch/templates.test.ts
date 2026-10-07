import { beforeEach, describe, expect, it } from 'vitest'
import { render } from './templates'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://carmart.example'
})

describe('email templates', () => {
  it('shop_rejected includes the shop, the reason and a link to /sell', () => {
    const r = render('shop_rejected', { shopName: 'Coastal Cars', reason: 'Blurry name' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.subject).toContain('Coastal Cars')
    expect(r.value.text).toContain('Blurry name')
    expect(r.value.text).toContain('https://carmart.example/sell')
    expect(r.value.html).toContain('<a href="https://carmart.example/sell"')
  })

  it('shop_approved links to the public shop page', () => {
    const r = render('shop_approved', { shopName: 'Coastal Cars', slug: 'coastal-cars' })
    expect(r.ok && r.value.text).toContain('https://carmart.example/shops/coastal-cars')
  })

  it('listing_live says the car is live and links to its public page', () => {
    const r = render('listing_live', { title: '2019 Toyota HiLux', listingId: 'x' })
    expect(r.ok && r.value.subject).toContain('is live')
    expect(r.ok && r.value.text).toContain('https://carmart.example/cars/x')
  })

  it('listing_rejected lists each photo reason and links to the seller page', () => {
    const r = render('listing_rejected', { title: '2019 Toyota HiLux', listingId: 'x', photos: [{ position: 2, reason: 'Stock photo' }] })
    expect(r.ok && r.value.text).toContain('Photo 2: Stock photo')
    expect(r.ok && r.value.text).toContain('https://carmart.example/sell/listings/x')
  })

  it('listing_in_review explains the wait and links to the seller page', () => {
    const r = render('listing_in_review', { title: '2019 Toyota HiLux', listingId: 'x' })
    expect(r.ok && r.value.subject).toContain('being reviewed')
    expect(r.ok && r.value.text).toContain('https://carmart.example/sell/listings/x')
  })

  it('listing_expiring gives the date and links to the seller page', () => {
    const r = render('listing_expiring', { title: '2019 Toyota HiLux', listingId: 'x', expiresAt: '2026-11-27T10:00:00Z' })
    expect(r.ok && r.value.subject).toMatch(/expires on 27 Nov 2026/)
    expect(r.ok && r.value.text).toContain('https://carmart.example/sell/listings/x')
  })

  it('escapes HTML in payload values', () => {
    const r = render('shop_rejected', { shopName: '<script>x</script>', reason: 'a & b' })
    expect(r.ok && r.value.html).not.toContain('<script>')
    expect(r.ok && r.value.html).toContain('&lt;script&gt;')
  })

  it('unknown kinds are an error, not a crash', () => {
    expect(render('nope', {})).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TEMPLATE' } })
  })

  it('new_message shows the sender, the car, a 200-char preview and links to the inbox thread', () => {
    const r = render('new_message', { senderName: 'Jo', title: '2019 Toyota HiLux', preview: 'x'.repeat(300), path: '/sell/messages/c1', recipientRole: 'seller' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.subject).toBe('New message about your 2019 Toyota HiLux')
    expect(r.value.text).toContain('Jo')
    expect(r.value.text).toContain(`${'x'.repeat(200)}…`)
    expect(r.value.text).not.toContain('x'.repeat(201))
    expect(r.value.text).toContain('https://carmart.example/sell/messages/c1')
  })

  it('new_message to a buyer names the car neutrally', () => {
    const r = render('new_message', { senderName: 'Coastal Cars', title: '2019 Toyota HiLux', preview: 'Yes', path: '/account/messages/c1', recipientRole: 'buyer' })
    expect(r.ok && r.value.subject).toBe('New message about the 2019 Toyota HiLux')
    expect(r.ok && r.value.text).not.toContain('…')
  })

  it('listing_removed gives the reason and links to the seller’s cars', () => {
    const r = render('listing_removed', { title: '2019 Toyota HiLux', listingId: 'x', reason: 'Listing breaks our rules' })
    expect(r.ok && r.value.subject).toBe('Your 2019 Toyota HiLux was removed from CarMart')
    expect(r.ok && r.value.text).toContain('Reason: Listing breaks our rules')
    expect(r.ok && r.value.text).toContain('https://carmart.example/sell/listings')
  })

  it('listing_rejected by an admin shows the reason instead of photo lines', () => {
    const r = render('listing_rejected', { title: '2019 Toyota HiLux', listingId: 'x', reason: 'VIN belongs to another car', photos: [] })
    expect(r.ok && r.value.subject).toBe('Your 2019 Toyota HiLux needs changes')
    expect(r.ok && r.value.text).toContain('Reason: VIN belongs to another car')
    expect(r.ok && r.value.text).not.toContain('photos didn’t pass')
  })
})
