import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }))
import { MessageSellerButton } from './MessageSellerButton'

const LISTING = '11111111-1111-4111-8111-111111111111'

afterEach(() => { vi.unstubAllGlobals(); push.mockReset() })

describe('MessageSellerButton', () => {
  it('signed out: links to sign-in and back to the car', () => {
    render(<MessageSellerButton listingId={LISTING} title="2019 Toyota HiLux" signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Message seller' }))
      .toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(`/cars/${LISTING}`)}`)
  })

  it('signed in: opens a prefilled composer, POSTs and goes to the thread', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { conversation_id: 'c9', created: true } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MessageSellerButton listingId={LISTING} title="2019 Toyota HiLux" signedIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Message seller' }))
    const box = screen.getByRole('textbox', { name: 'Your message' })
    expect(box).toHaveValue('Hi, is the 2019 Toyota HiLux still available?')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/messages/c9'))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/conversations')
    expect(JSON.parse(String(init.body))).toEqual({ listing_id: LISTING, body: 'Hi, is the 2019 Toyota HiLux still available?' })
  })

  it('CONVERSATION_LIMIT shows the friendly limit text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'CONVERSATION_LIMIT', message: 'x' } }), { status: 429 })))
    render(<MessageSellerButton listingId={LISTING} title="2019 Toyota HiLux" signedIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Message seller' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You’ve started a lot of conversations today — try again tomorrow')
    expect(push).not.toHaveBeenCalled()
  })
})
