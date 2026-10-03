import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomeView } from '@/components/home/HomeView'

const makes = [{ id: 't1', name: 'Toyota' }, { id: 'f1', name: 'Ford' }, { id: 'z1', name: 'Zeekr' }]

describe('home page', () => {
  it('leads with a car search that sends make, body type, price and state to /cars', () => {
    render(<HomeView makes={makes} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Find your next car.')
    const form = screen.getByRole('search', { name: 'Search cars' })
    expect(form).toHaveAttribute('action', '/cars')
    expect(within(form).getByLabelText('Make')).toHaveAttribute('name', 'make_id')
    expect(within(form).getByRole('option', { name: 'Toyota' })).toHaveValue('t1')
    expect(within(form).getByLabelText('Body type')).toHaveAttribute('name', 'body_type')
    expect(within(form).getByRole('option', { name: '$30,000' })).toHaveValue('3000000')
    expect(within(form).getByLabelText('State')).toHaveAttribute('name', 'state')
    expect(within(form).getByRole('button', { name: 'Search cars' })).toBeInTheDocument()
  })

  it('offers body-type and popular-make shortcuts that link to search', () => {
    render(<HomeView makes={makes} />)
    expect(screen.getByRole('link', { name: 'Ute' })).toHaveAttribute('href', '/cars?body_type=ute')
    expect(screen.getByRole('link', { name: 'Toyota' })).toHaveAttribute('href', '/cars?make_id=t1')
    expect(screen.queryByRole('link', { name: 'Zeekr' })).toBeNull()
  })

  it('explains why to buy here and invites sellers', () => {
    render(<HomeView makes={makes} />)
    for (const t of ['Every seller is verified', 'Real photos of the real car', 'History you can check']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Open a free shop' })).toHaveAttribute('href', '/sell')
    expect(screen.getByText(/Traditional Custodians of Country/)).toBeInTheDocument()
  })

  it('still works with no makes loaded', () => {
    render(<HomeView makes={[]} />)
    expect(screen.queryByRole('heading', { name: 'Popular makes' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Any make' })).toBeInTheDocument()
  })
})
