import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))
import type { PublicListingView } from '@/services/search.service'
import { ListingDetail } from './ListingDetail'

const listing: PublicListingView = {
  view: 'public', id: 'l1', title: '2019 Toyota HiLux', make: 'Toyota', model: 'HiLux', year: 2019, odometer_km: 84_000,
  price_cents: 1_850_000_000, currency: 'NGN', condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic',
  fuel: 'diesel', colour: 'White', vin: 'JTFST22P900123456', description: 'One owner.\nFull service history.', state: 'Lagos',
  city: 'Ikeja', status: 'live', live_at: '2026-09-28T10:00:00Z', sold_at: null, expires_at: null,
  shop: { id: 's1', name: 'Coastal Cars', slug: 'coastal-cars', city: 'Ikeja', state: 'Lagos', verified: true },
  photos: [{ id: 'p1', position: 0, urls: { sm: '/sm.webp', md: '/md.webp', lg: '/lg.webp' } }],
}

describe('/cars/[id] listing detail', () => {
  it('shows the title, price, description and a shop card linking to the shop', () => {
    render(<ListingDetail listing={listing} />)
    expect(screen.getByRole('heading', { level: 1, name: '2019 Toyota HiLux' })).toBeInTheDocument()
    expect(screen.getAllByText('₦18,500,000').length).toBeGreaterThan(0)
    expect(screen.getByText(/Full service history/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Coastal Cars/ })).toHaveAttribute('href', '/shops/coastal-cars')
    expect(screen.getByText('Verified shop')).toBeInTheDocument()
  })

  it('live: Message seller and Save work; Report stays disabled until it arrives', () => {
    render(<ListingDetail listing={listing} signedIn saved />)
    expect(screen.getByRole('button', { name: 'Message seller' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Report' })).toBeDisabled()
  })

  it('visitors get a sign-in link; the owner sees no Message seller', () => {
    const { unmount } = render(<ListingDetail listing={listing} />)
    expect(screen.getByRole('link', { name: 'Message seller' })).toHaveAttribute('href', '/sign-in?next=%2Fcars%2Fl1')
    unmount()
    render(<ListingDetail listing={listing} signedIn isOwner />)
    expect(screen.queryByRole('button', { name: 'Message seller' })).toBeNull()
    expect(screen.getByText('This is your listing.')).toBeInTheDocument()
  })

  it('sold: a SOLD banner and no contact actions', () => {
    render(<ListingDetail listing={{ ...listing, status: 'sold', sold_at: '2026-10-01T10:00:00Z' }} />)
    expect(screen.getByText('SOLD')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Message seller' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Message seller' })).toBeNull()
  })
})
