import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
import { DecisionButtons } from './DecisionButtons'

afterEach(() => { vi.unstubAllGlobals(); refresh.mockReset() })

describe('DecisionButtons', () => {
  it('Approve POSTs and the card disappears', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'i1', status: 'checking' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<div data-testid="card"><DecisionButtons endpoint="/api/admin/images/i1" approveLabel="Approve photo" rejectTitle="Reject photo 1" /></div>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Approve photo' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/images/i1/approve', expect.objectContaining({ method: 'POST' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Done'))
    expect(screen.queryByRole('button', { name: 'Approve photo' })).toBeNull()
    expect(refresh).toHaveBeenCalled()
  })

  it('Reject asks for a reason and sends it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'i1', status: 'checking' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<DecisionButtons endpoint="/api/admin/images/i1" approveLabel="Approve photo" rejectTitle="Reject photo 1" />)
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.type(screen.getByRole('textbox'), 'Shows a number plate')
    await user.click(screen.getByRole('button', { name: 'Reject photo 1' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/images/i1/reject')
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Shows a number plate' })
  })

  it('shows the server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_STATE', message: 'This item has already been decided' } }), { status: 409 })))
    render(<DecisionButtons endpoint="/api/admin/images/i1" approveLabel="Approve photo" rejectTitle="Reject photo 1" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Approve photo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This item has already been decided')
  })

  it('a custom positive action (clear-flag) sends its body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'l1', status: 'live' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<DecisionButtons endpoint="/api/admin/listings/l1" approveLabel="Clear flag" rejectTitle="Reject listing"
      approveAction="clear-flag" approveBody={{ flag: 'duplicate_vin' }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear flag' }))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/listings/l1/clear-flag')
    expect(JSON.parse(String(init.body))).toEqual({ flag: 'duplicate_vin' })
  })
})
