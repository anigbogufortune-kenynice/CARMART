import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@/services/messaging.service'
import { ThreadView } from './ThreadView'

const ME = 'u-me'
const msg = (id: string, sender: string, body: string, at: string): Message =>
  ({ id, conversation_id: 'c1', sender_id: sender, body, read_at: null, created_at: at })
const MESSAGES = [
  msg('m1', ME, 'Hi, is it available?', '2026-10-01T10:00:00Z'),
  msg('m2', 'u-shop', 'Yes it is', '2026-10-01T10:05:00Z'),
  msg('m3', ME, 'Great, can I see it Saturday?', '2026-10-01T10:06:00Z'),
]

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('ThreadView', () => {
  it('shows messages oldest to newest with my messages on the right', () => {
    render(<ThreadView conversationId="c1" currentUserId={ME} initial={MESSAGES} />)
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Hi, is it available?'), expect.stringContaining('Yes it is'), expect.stringContaining('Saturday'),
    ])
    expect(items[0]).toHaveAttribute('data-mine', 'true')
    expect(items[1]).toHaveAttribute('data-mine', 'false')
  })

  it('counts characters and disables Send over 2000', () => {
    render(<ThreadView conversationId="c1" currentUserId={ME} initial={MESSAGES} />)
    const box = screen.getByRole('textbox', { name: 'Your message' })
    fireEvent.change(box, { target: { value: 'a'.repeat(2001) } })
    expect(screen.getByText('2001/2000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.change(box, { target: { value: 'Hello' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('polls for new messages every 10 s and stops on unmount', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: [...MESSAGES, msg('m4', 'u-shop', 'Saturday works', '2026-10-01T10:10:00Z')] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { unmount } = render(<ThreadView conversationId="c1" currentUserId={ME} initial={MESSAGES} />)
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations/c1/messages', expect.anything())
    expect(screen.getByText('Saturday works')).toBeInTheDocument()
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends a message and appends it', async () => {
    const sent = msg('m5', ME, 'See you then', '2026-10-01T10:12:00Z')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: sent }), { status: 201 })))
    render(<ThreadView conversationId="c1" currentUserId={ME} initial={MESSAGES} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), { target: { value: 'See you then' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('See you then', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveValue('')
  })
})
