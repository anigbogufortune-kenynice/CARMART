import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomeView } from '@/components/home/HomeView'

const makes = [{ id: 't1', name: 'Toyota' }, { id: 'l1', name: 'Lexus' }, { id: 'z1', name: 'Zotye' }]

describe('home page', () => {
  it('leads with a car search that sends make, condition, price (kobo) and state to /cars', () => {
    render(<HomeView makes={makes} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Find your next car.')
    const form = screen.getByRole('search', { name: 'Search cars' })
    expect(form).toHaveAttribute('action', '/cars')
    expect(within(form).getByLabelText('Make')).toHaveAttribute('name', 'make_id')
    expect(within(form).getByRole('option', { name: 'Toyota' })).toHaveValue('t1')
    expect(within(form).getByLabelText('Condition')).toHaveAttribute('name', 'condition')
    expect(within(form).getByRole('option', { name: 'Foreign used (Tokunbo)' })).toHaveValue('foreign_used')
    expect(within(form).getByRole('option', { name: '₦10,000,000' })).toHaveValue('1000000000')
    expect(within(form).getByRole('option', { name: 'All of Nigeria' })).toBeInTheDocument()
    expect(within(form).getByRole('option', { name: 'FCT (Abuja)' })).toHaveValue('FCT')
    expect(within(form).getByLabelText('State')).toHaveAttribute('name', 'state')
    expect(within(form).getByRole('button', { name: 'Search cars' })).toBeInTheDocument()
  })

  it('offers body-type and popular-make shortcuts that link to search', () => {
    render(<HomeView makes={makes} />)
    expect(screen.getByRole('link', { name: 'Pickup' })).toHaveAttribute('href', '/cars?body_type=pickup')
    expect(screen.getByRole('link', { name: 'Toyota' })).toHaveAttribute('href', '/cars?make_id=t1')
    expect(screen.getByRole('link', { name: 'Lexus' })).toHaveAttribute('href', '/cars?make_id=l1')
    expect(screen.queryByRole('link', { name: 'Zotye' })).toBeNull()
  })

  it('explains why to buy here and invites sellers', () => {
    render(<HomeView makes={makes} />)
    for (const t of ['Every seller is verified', 'Real photos of the real car', 'History you can check']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Open a free shop' })).toHaveAttribute('href', '/sell')
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveTextContent('From Nigerian sellers')
    expect(screen.getByText(/inspect the car and its papers in person/)).toBeInTheDocument()
  })

  it('still works with no makes loaded', () => {
    render(<HomeView makes={[]} />)
    expect(screen.queryByRole('heading', { name: 'Popular makes' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Any make' })).toBeInTheDocument()
  })

  it('shows the latest live cars when there are some, with a link to all cars', () => {
    const latest = [{
      id: 'c1', title: '2019 Toyota HiLux', price_cents: 1_850_000_000, currency: 'NGN', year: 2019, odometer_km: 84_000,
      condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel', city: 'Ikeja', state: 'Lagos' as const,
      thumbnail_url: null, shop: { name: 'Coastal Cars', slug: 'coastal-cars', verified: true }, live_at: null,
    }]
    const { rerender } = render(<HomeView makes={makes} latest={latest} />)
    expect(screen.getByRole('heading', { name: 'Latest cars' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2019 Toyota HiLux/ })).toHaveAttribute('href', '/cars/c1')
    expect(screen.getByRole('link', { name: 'See all cars' })).toHaveAttribute('href', '/cars')
    rerender(<HomeView makes={makes} latest={[]} />)
    expect(screen.queryByRole('heading', { name: 'Latest cars' })).toBeNull()
  })
})
