import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({ auth: { getSession, resetPasswordForEmail, updateUser } }),
}))

import ResetPage from './page'

beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ error: null })
  updateUser.mockReset().mockResolvedValue({ error: null })
})

describe('password reset', () => {
  it('request mode sends a reset link through the callback', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const user = userEvent.setup()
    render(<ResetPage />)
    await user.type(await screen.findByLabelText('Email'), 'jo@x.au')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('jo@x.au', {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })
    expect(await screen.findByText('If an account exists for that email, a reset link is on its way.')).toBeInTheDocument()
  })

  it('update mode (after following the link) sets a new password of 10+ characters', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } })
    const user = userEvent.setup()
    render(<ResetPage />)
    const input = await screen.findByLabelText('New password')
    await user.type(input, 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Password must be at least 10 characters')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, 'a-new-long-password')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(updateUser).toHaveBeenCalledWith({ password: 'a-new-long-password' })
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
  })
})
