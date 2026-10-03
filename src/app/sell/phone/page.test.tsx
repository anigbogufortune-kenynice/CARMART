import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhonePage from './page'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }))
const fail = (status: number, code: string) => Promise.resolve(new Response(JSON.stringify({ error: { code, message: code } }), { status }))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  fetchMock.mockReset()
  vi.useRealTimers()
})

describe('/sell/phone', () => {
  it('normalises the number, sends a code, then verifies it', async () => {
    fetchMock.mockImplementation((url: string) => (url.endsWith('send-code') ? ok({ sent: true }) : ok({ phone_verified: true })))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PhonePage />)
    await user.type(screen.getByLabelText('Mobile number'), '0803 123 4567')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ phone: '+2348031234567' })
    await user.type(await screen.findByLabelText('6-digit code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ phone: '+2348031234567', code: '123456' })
    expect(await screen.findByText('Phone verified')).toBeInTheDocument()
  })

  it('rejects landlines before calling the server', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PhonePage />)
    await user.type(screen.getByLabelText('Mobile number'), '01 234 5678')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(screen.getByText('Enter a Nigerian mobile number (e.g. 0803 123 4567)')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a wrong code in plain words and allows resending only after 60 s', async () => {
    fetchMock.mockImplementation((url: string) => (url.endsWith('send-code') ? ok({ sent: true }) : fail(422, 'INVALID_CODE')))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PhonePage />)
    await user.type(screen.getByLabelText('Mobile number'), '08031234567')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('6-digit code'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByText('That code isn’t right')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled()
    await act(async () => { vi.advanceTimersByTime(61_000) })
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled()
  })
})
