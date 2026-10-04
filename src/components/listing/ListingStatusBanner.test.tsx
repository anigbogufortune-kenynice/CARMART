import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListingStatusBanner } from './ListingStatusBanner'

const base = { statusReason: null, reviewFlags: [], liveAt: null, photos: [] }

describe('ListingStatusBanner', () => {
  it('rejected lists each rejected photo’s reason', () => {
    render(<ListingStatusBanner {...base} status="rejected" statusReason="One or more photos were rejected"
      photos={[{ status: 'passed', status_reason: null }, { status: 'rejected', status_reason: "This photo doesn't show a car." }]} />)
    expect(screen.getByText('Some photos were rejected')).toBeInTheDocument()
    expect(screen.getByText("Photo 2: This photo doesn't show a car.")).toBeInTheDocument()
  })

  it('in_review explains each flag in plain words', () => {
    render(<ListingStatusBanner {...base} status="in_review" reviewFlags={['duplicate_vin']} />)
    expect(screen.getByText('We’re checking this car’s VIN — usually within a day')).toBeInTheDocument()
  })

  it('in_review because a photo is under review', () => {
    render(<ListingStatusBanner {...base} status="in_review" photos={[{ status: 'in_review', status_reason: 'x' }]} />)
    expect(screen.getByText('Some photos are being double-checked — usually within a day')).toBeInTheDocument()
  })

  it('checking and live', () => {
    const { rerender } = render(<ListingStatusBanner {...base} status="checking" />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking your photos…')
    rerender(<ListingStatusBanner {...base} status="live" liveAt="2026-09-20T02:00:00Z" />)
    expect(screen.getByRole('status')).toHaveTextContent('Live since 20 Sept 2026')
  })

  it('an admin rejection reason is shown as given', () => {
    render(<ListingStatusBanner {...base} status="rejected" statusReason="The price looks like a placeholder." />)
    expect(screen.getByText('The price looks like a placeholder.')).toBeInTheDocument()
  })

  it('renders nothing for a draft', () => {
    const { container } = render(<ListingStatusBanner {...base} status="draft" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sold shows the sale date in Lagos time', () => {
    render(<ListingStatusBanner {...base} status="sold" soldAt="2026-09-28T10:00:00Z" />)
    expect(screen.getByText(/^Sold on 28 Sept? 2026. Buyers can still open it for 7 days.$/)).toBeInTheDocument()
  })
})
