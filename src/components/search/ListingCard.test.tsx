import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListingCard } from './ListingCard'

const car = {
  id: 'l1', title: '2019 Toyota HiLux', price_cents: 1_850_000_000, currency: 'NGN', year: 2019, odometer_km: 84_000,
  condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel', city: 'Ikeja', state: 'Lagos' as const,
  thumbnail_url: 'https://cdn.example/l1-sm.webp', shop: { name: 'Coastal Cars', slug: 'coastal-cars', verified: true }, live_at: null,
}

describe('ListingCard', () => {
  it('shows the photo (lazy, alt = title), price in naira, km, condition, place and the verified badge, linking to the car', () => {
    render(<ListingCard car={car} />)
    const img = screen.getByRole('img', { name: '2019 Toyota HiLux' })
    expect(img).toHaveAttribute('src', 'https://cdn.example/l1-sm.webp')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(screen.getByText('₦18,500,000')).toBeInTheDocument()
    expect(screen.getByText(/84,000 km/)).toBeInTheDocument()
    expect(screen.getByText(/Foreign used \(Tokunbo\)/)).toBeInTheDocument()
    expect(screen.getByText('Ikeja, Lagos')).toBeInTheDocument()
    expect(screen.getByText('Verified shop')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/cars/l1')
  })

  it('no photo → a placeholder; unverified → no badge', () => {
    render(<ListingCard car={{ ...car, thumbnail_url: null, shop: { ...car.shop, verified: false } }} />)
    expect(screen.queryByRole('img', { name: '2019 Toyota HiLux' })).toBeNull()
    expect(screen.getByText('No photo yet')).toBeInTheDocument()
    expect(screen.queryByText('Verified shop')).toBeNull()
  })
})
