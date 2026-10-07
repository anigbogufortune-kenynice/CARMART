import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportDialog } from './ReportDialog'

const ID = '11111111-1111-4111-8111-111111111111'
afterEach(() => vi.unstubAllGlobals())

describe('ReportDialog', () => {
  it('visitors are asked to sign in', () => {
    render(<ReportDialog targetType="listing" targetId={ID} signedIn={false} returnTo={`/cars/${ID}`} />)
    expect(screen.getByRole('link', { name: 'Report' })).toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(`/cars/${ID}`)}`)
  })

  it('submit is disabled until a reason is chosen; success thanks the user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'r1' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ReportDialog targetType="listing" targetId={ID} signedIn returnTo={`/cars/${ID}`} />)
    await user.click(screen.getByRole('button', { name: 'Report' }))
    const send = screen.getByRole('button', { name: 'Send report' })
    expect(send).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Scam or fraud/ }))
    await user.type(screen.getByRole('textbox', { name: /Anything else/ }), 'Price too good')
    await user.click(send)
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks — our team will review this')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/reports')
    expect(JSON.parse(String(init.body))).toEqual({ target_type: 'listing', target_id: ID, reason: 'scam', note: 'Price too good' })
  })

  it('409 ALREADY_REPORTED says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'ALREADY_REPORTED', message: 'x' } }), { status: 409 })))
    const user = userEvent.setup()
    render(<ReportDialog targetType="shop" targetId={ID} signedIn returnTo="/shops/x" />)
    await user.click(screen.getByRole('button', { name: 'Report' }))
    await user.click(screen.getByRole('radio', { name: /Offensive/ }))
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You’ve already reported this')
  })
})
