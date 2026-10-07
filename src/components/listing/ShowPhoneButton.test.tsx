import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShowPhoneButton } from './ShowPhoneButton'

const LISTING = '11111111-1111-4111-8111-111111111111'
afterEach(() => vi.unstubAllGlobals())

describe('ShowPhoneButton', () => {
  it('visitors are prompted to sign in', () => {
    render(<ShowPhoneButton listingId={LISTING} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Sign in to see the phone number' }))
      .toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(`/cars/${LISTING}`)}`)
  })

  it('click fetches the number and shows a tel: link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { phone: '+2348031234567' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ShowPhoneButton listingId={LISTING} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Show phone' }))
    const link = await screen.findByRole('link', { name: /\+234 803 123 4567/ })
    expect(link).toHaveAttribute('href', 'tel:+2348031234567')
    expect(fetchMock).toHaveBeenCalledWith(`/api/listings/${LISTING}/phone`)
  })

  it('PHONE_NOT_AVAILABLE explains the number is hidden', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'PHONE_NOT_AVAILABLE', message: 'x' } }), { status: 404 })))
    render(<ShowPhoneButton listingId={LISTING} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Show phone' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This seller’s number isn’t available. Send them a message instead.')
  })
})
