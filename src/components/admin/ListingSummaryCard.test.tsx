import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ListingSummary } from '@/services/moderation.service'
import { ListingSummaryCard } from './ListingSummaryCard'

const held: ListingSummary = {
  id: 'b', title: '2019 Toyota HiLux', vin: 'JTFST22P900123456', make_other: null, model_other: null, status: 'in_review',
  review_flags: ['duplicate_vin'], shop: { id: 's2', name: 'Coastal Cars', slug: 'coastal-cars' }, photo_url: null,
  submitted_at: '2026-10-02T10:00:00Z', live_at: null,
}

describe('ListingSummaryCard', () => {
  it('shows title, shop, status and VIN; links only public listings', () => {
    const { container } = render(<div>
      <ListingSummaryCard listing={held} label="Held for review" />
      <ListingSummaryCard listing={{ ...held, id: 'a', status: 'live', shop: { id: 's1', name: 'First Motors', slug: 'first' }, live_at: '2026-09-20T10:00:00Z', photo_url: '/a.webp' }} label="Already using this VIN" />
    </div>)
    const [left, right] = Array.from(container.querySelectorAll('article'))
    expect(within(left as HTMLElement).getByText('Coastal Cars')).toBeInTheDocument()
    expect(within(left as HTMLElement).queryByRole('link')).toBeNull()
    expect(within(right as HTMLElement).getByRole('link', { name: '2019 Toyota HiLux' })).toHaveAttribute('href', '/cars/a')
    expect(within(right as HTMLElement).getByRole('img')).toHaveAttribute('src', '/a.webp')
    expect(screen.getAllByText('JTFST22P900123456')).toHaveLength(2)
  })

  it('shows the typed make/model for Other entries', () => {
    render(<ListingSummaryCard listing={{ ...held, make_other: 'Holden-ish', model_other: 'Special' }} />)
    expect(screen.getByText('Holden-ish · Special')).toBeInTheDocument()
  })
})
