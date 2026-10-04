import { describe, expect, it } from 'vitest'
import { buildSitemap, listingMetadata, robotsRules, shopMetadata } from './seo'

const SITE = 'https://carmart.example'

describe('listingMetadata', () => {
  it('title with price, description with km and place, OG image = first lg photo, canonical URL', () => {
    const m = listingMetadata({
      id: 'l1', title: '2019 Toyota HiLux', price_cents: 1_850_000_000, odometer_km: 84_000, city: 'Ikeja', state: 'Lagos', condition: 'foreign_used',
      photos: [{ id: 'p', position: 0, urls: { sm: '/sm', md: '/md', lg: 'https://cdn/lg.webp' } }],
    }, SITE)
    expect(m.title).toBe('2019 Toyota HiLux – ₦18,500,000 | CarMart')
    expect(m.description).toContain('84,000 km')
    expect(m.description).toContain('Ikeja, Lagos')
    expect(m.alternates?.canonical).toBe('https://carmart.example/cars/l1')
    expect(JSON.stringify(m.openGraph)).toContain('https://cdn/lg.webp')
  })
})

describe('shopMetadata', () => {
  it('names the shop and its city', () => {
    expect(shopMetadata({ name: 'Coastal Cars', city: 'Ikeja', slug: 'coastal-cars' }, SITE).title)
      .toBe('Coastal Cars – Verified car seller in Ikeja | CarMart')
  })
})

describe('buildSitemap', () => {
  it('lists the fixed pages, live cars and approved shops', () => {
    const map = buildSitemap(SITE, [{ id: 'l1', updated_at: '2026-10-01T00:00:00Z' }], [{ slug: 'coastal-cars', created_at: '2026-09-01T00:00:00Z' }])
    const urls = map.map((e) => e.url)
    for (const p of ['', '/cars', '/terms', '/privacy', '/prohibited-listings', '/buyer-safety', '/contact']) expect(urls).toContain(`${SITE}${p}`)
    expect(urls).toContain(`${SITE}/cars/l1`)
    expect(urls).toContain(`${SITE}/shops/coastal-cars`)
    expect(map.find((e) => e.url.endsWith('/cars/l1'))?.lastModified).toEqual(new Date('2026-10-01T00:00:00Z'))
  })
})

describe('robotsRules', () => {
  it('allows / and keeps private areas out; points at the sitemap', () => {
    const r = robotsRules(SITE)
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/', disallow: ['/sell', '/account', '/admin', '/api'] })
    expect(r.sitemap).toBe('https://carmart.example/sitemap.xml')
  })
})
