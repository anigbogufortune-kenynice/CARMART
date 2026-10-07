import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@/services/messaging.service'
import { ConversationList } from './ConversationList'

const base: ConversationSummary = {
  id: 'c1', listing_id: 'l1', listing_title: '2019 Toyota HiLux', listing_status: 'live', thumbnail_url: '/sm.webp',
  other_party: 'Coastal Cars', role: 'buyer', unread_count: 2, blocked: false, last_message_at: '2026-10-01T10:05:00Z',
  last_message: { body: 'Yes it is available', created_at: '2026-10-01T10:05:00Z', mine: false },
}

describe('ConversationList', () => {
  it('shows thumbnail, title, preview, time and an unread dot linking to the thread', () => {
    render(<ConversationList items={[base, { ...base, id: 'c2', unread_count: 0, last_message: { ...base.last_message!, mine: true, body: 'Thanks' } }]} basePath="/account/messages" />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/account/messages/c1')
    expect(links[0]).toHaveTextContent('2019 Toyota HiLux')
    expect(links[0]).toHaveTextContent('Yes it is available')
    expect(links[0].querySelector('img')).toHaveAttribute('src', '/sm.webp')
    expect(screen.getAllByLabelText('2 unread')).toHaveLength(1)
    expect(links[1]).toHaveTextContent('You: Thanks')
    expect(links[0].querySelector('time')).toHaveAttribute('dateTime', '2026-10-01T10:05:00Z')
  })

  it('seller side: shows the buyer’s display name and the car title', () => {
    render(<ConversationList items={[{ ...base, role: 'seller', other_party: 'Jo' }]} basePath="/sell/messages" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/sell/messages/c1')
    expect(screen.getByText('Jo')).toBeInTheDocument()
    expect(screen.getByText('2019 Toyota HiLux')).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    render(<ConversationList items={[]} basePath="/account/messages" empty="No messages yet." />)
    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })
})
