import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ImageQueueItem } from '@/services/moderation.service'
import { ImageEvidence } from './ImageEvidence'

const item: ImageQueueItem = {
  id: 'i1', position: 2, created_at: '2026-10-01T10:00:00Z', signed_url: 'https://s/q.jpg?token=a',
  listing: { id: 'l1', title: '2019 Toyota HiLux', status: 'checking' },
  shop: { id: 's1', name: 'Coastal Cars', slug: 'coastal-cars' },
  car_check: { is_car: true, confidence: 0.93, view: 'exterior', is_screen_or_print: false },
  ai_check: { score: 0.7 },
  metadata_signals: { has_exif: false },
  phash_match: null,
  thresholds: { aiReviewThreshold: 0.5, aiRejectThreshold: 0.9 },
  decision_reason: 'Our team is checking this photo',
}

describe('ImageEvidence', () => {
  it('shows the photo (click to enlarge) and the evidence lines', () => {
    render(<ImageEvidence item={item} />)
    expect(screen.getByText('AI score 0.70 (review ≥ 0.50, reject ≥ 0.90)')).toBeInTheDocument()
    expect(screen.getByText('Car: yes (0.93), exterior')).toBeInTheDocument()
    expect(screen.getByText('Screen/print: no')).toBeInTheDocument()
    expect(screen.getByText('EXIF: none')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open photo 3 full size/ })).toHaveAttribute('href', 'https://s/q.jpg?token=a')
    expect(screen.getByText(/2019 Toyota HiLux/)).toBeInTheDocument()
    expect(screen.queryByText('Possible reused photo')).toBeNull()
  })

  it('a pHash match shows both photos side by side', () => {
    render(<ImageEvidence item={{
      ...item, metadata_signals: { has_exif: true, camera_make: 'Canon', camera_model: 'EOS 90D' },
      phash_match: { distance: 2, matched_image_id: 'm1', matched_shop_id: 's2', matched_shop_name: 'First Motors', matched_listing_id: 'l2', matched_signed_url: 'https://s/m.jpg?token=b' },
    }} />)
    expect(screen.getByText('Possible reused photo')).toBeInTheDocument()
    expect(screen.getByText(/First Motors/)).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('EXIF: Canon EOS 90D')).toBeInTheDocument()
  })
})
