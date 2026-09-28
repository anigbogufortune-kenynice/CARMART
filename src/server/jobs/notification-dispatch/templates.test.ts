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

  it('escapes HTML in payload values', () => {
    const r = render('shop_rejected', { shopName: '<script>x</script>', reason: 'a & b' })
    expect(r.ok && r.value.html).not.toContain('<script>')
    expect(r.ok && r.value.html).toContain('&lt;script&gt;')
  })

  it('unknown kinds are an error, not a crash', () => {
    expect(render('nope', {})).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TEMPLATE' } })
  })
})
