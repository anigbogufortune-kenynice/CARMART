import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
import { ReportActions } from './ReportActions'

afterEach(() => vi.unstubAllGlobals())
const ok = () => new Response(JSON.stringify({ data: {} }), { status: 200 })

describe('ReportActions', () => {
  it('Dismiss & restore listing dismisses the reports, then clears reports_threshold', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ReportActions reportId="r1" restoreListingId="l1" />)
    await user.click(screen.getByRole('button', { name: 'Dismiss & restore listing' }))
    await user.type(screen.getByRole('textbox'), 'Checked, legit')
    await user.click(screen.getByRole('button', { name: 'Dismiss and restore' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(calls[0][0]).toBe('/api/admin/reports/r1/dismiss')
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ reason: 'Checked, legit' })
    expect(calls[1][0]).toBe('/api/admin/listings/l1/clear-flag')
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ flag: 'reports_threshold', reason: 'Checked, legit' })
    expect(await screen.findByRole('status')).toHaveTextContent('Done')
  })

  it('without a held listing there is no restore option; Mark actioned posts action', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ReportActions reportId="r2" />)
    expect(screen.queryByRole('button', { name: 'Dismiss & restore listing' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mark actioned' }))
    await user.type(screen.getByRole('textbox'), 'Removed the listing')
    await user.click(screen.getByRole('button', { name: 'Close as actioned' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/reports/r2/action', expect.anything()))
  })
})
