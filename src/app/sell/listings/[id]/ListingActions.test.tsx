import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))

import { ListingActions } from './ListingActions'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ListingActions: live listing', () => {
  it('Mark as sold asks for confirmation, then POSTs mark-sold with the version', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ListingActions listingId="l1" version={4} status="live" blockers={[]} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark as sold' }))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/listings/l1/mark-sold', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ version: 4 })
  })

  it('cancelling the confirmation sends nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ListingActions listingId="l1" version={4} status="live" blockers={[]} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark as sold' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
