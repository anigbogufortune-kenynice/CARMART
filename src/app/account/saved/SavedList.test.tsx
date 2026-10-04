import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SavedList } from './SavedList'

const base = {
  price_cents: 1_850_000_000, currency: 'NGN', year: 2019, odometer_km: 84_000, condition: 'foreign_used', body_type: 'pickup',
  transmission: 'automatic', fuel: 'diesel', city: 'Ikeja', state: 'Lagos' as const, thumbnail_url: null,
  shop: { name: 'Coastal Cars', slug: 'coastal-cars', verified: true }, live_at: null, saved_at: '2026-10-01T10:00:00Z',
}
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

describe('SavedList', () => {
  it('shows saved cards, and an unavailable one with a Remove button that removes it', async () => {
    render(<SavedList initial={[
      { ...base, id: 'a', title: '2019 Toyota HiLux', unavailable: false },
      { ...base, id: 'b', title: '2015 Honda Accord', unavailable: true },
    ]} />)
    expect(screen.getByRole('link', { name: /2019 Toyota HiLux/ })).toHaveAttribute('href', '/cars/a')
    expect(screen.getByText('No longer available')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/saved-listings/b', { method: 'DELETE' })
    await waitFor(() => expect(screen.queryByText('2015 Honda Accord')).toBeNull())
  })

  it('empty state links to browse', () => {
    render(<SavedList initial={[]} />)
    expect(screen.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars')
  })
})
