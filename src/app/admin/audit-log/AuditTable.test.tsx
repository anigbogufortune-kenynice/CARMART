import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AuditEntry } from '@/services/moderation.service'
import { AuditTable, timeAgo } from './AuditTable'

const NOW = new Date('2026-10-07T10:00:00Z')
const entry: AuditEntry = {
  id: 'a1', action: 'shop.approve', target_type: 'shop', target_id: 's1', reason: null,
  details: { before: 'pending_approval', after: 'approved' }, created_at: '2026-10-07T09:58:00Z',
  actor_id: 'u1', actor_name: 'Admin', target_label: 'Coastal Cars',
}

describe('AuditTable', () => {
  it('renders action · target · actor · time, with expandable details and a target link', () => {
    render(<AuditTable entries={[entry, { ...entry, id: 'a2', action: 'listing.remove', target_type: 'listing', target_id: 'l1', target_label: '2019 Toyota HiLux', reason: 'Breaks the rules' }]} now={NOW} />)
    const row = screen.getAllByRole('row')[1]
    expect(row).toHaveTextContent('shop.approve')
    expect(row).toHaveTextContent('Coastal Cars')
    expect(row).toHaveTextContent('Admin')
    expect(row).toHaveTextContent('2 min ago')
    expect(screen.getByRole('link', { name: '2019 Toyota HiLux' })).toHaveAttribute('href', '/cars/l1')
    expect(screen.getByText('Breaks the rules')).toBeInTheDocument()
    expect(screen.getAllByText('Details', { selector: 'summary' })[0].closest('details')).toHaveTextContent('"after": "approved"')
  })

  it('timeAgo', () => {
    expect(timeAgo('2026-10-07T09:59:40Z', NOW)).toBe('just now')
    expect(timeAgo('2026-10-07T07:00:00Z', NOW)).toBe('3 h ago')
    expect(timeAgo('2026-10-04T10:00:00Z', NOW)).toBe('3 days ago')
  })
})
