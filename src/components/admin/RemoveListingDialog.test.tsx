import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
import { RemoveListingDialog } from './RemoveListingDialog'

afterEach(() => vi.unstubAllGlobals())

describe('RemoveListingDialog', () => {
  it('requires a 5+ character reason, then POSTs remove', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'l1', status: 'removed' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<RemoveListingDialog listingId="l1" title="2019 Toyota HiLux" />)
    await user.click(screen.getByRole('button', { name: 'Remove listing' }))
    const confirm = screen.getByRole('button', { name: 'Remove 2019 Toyota HiLux' })
    await user.type(screen.getByRole('textbox'), 'bad')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox'), ' photos')
    await user.click(confirm)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/listings/l1/remove', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ reason: 'bad photos' })
    expect(await screen.findByRole('status')).toHaveTextContent('Listing removed')
  })
})
