import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }))

import { SaveButton } from './SaveButton'

const fetchMock = vi.fn()
beforeEach(() => {
  push.mockReset()
  fetchMock.mockReset().mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve(new Response(init?.method === 'DELETE' ? null : JSON.stringify({ data: { created: true } }), { status: init?.method === 'DELETE' ? 204 : 201 })))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('SaveButton', () => {
  it('signed out: sends the visitor to sign in and back', async () => {
    render(<SaveButton listingId="l1" signedIn={false} initialSaved={false} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }))
    expect(push).toHaveBeenCalledWith('/sign-in?next=%2Fcars%2Fl1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signed in: toggles, calling POST then DELETE', async () => {
    const user = userEvent.setup()
    render(<SaveButton listingId="l1" signedIn initialSaved={false} />)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/saved-listings', expect.objectContaining({ method: 'POST', body: JSON.stringify({ listing_id: 'l1' }) }))
    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/saved-listings/l1', expect.objectContaining({ method: 'DELETE' }))
  })
})
