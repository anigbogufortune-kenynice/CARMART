import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase Auth is external: mocked at the @supabase/ssr boundary.
const signUp = vi.fn()
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signUp } }) }))

import SignUpPage from './page'

async function fill(name: string, email: string, password: string) {
  const user = userEvent.setup()
  render(<SignUpPage />)
  if (name) await user.type(screen.getByLabelText('Display name'), name)
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('sign-up page', () => {
  it('rejects a short password without calling Supabase', async () => {
    await fill('Jo', 'jo@x.au', 'short')
    expect(await screen.findByText('Password must be at least 10 characters')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('requires a display name and a valid email', async () => {
    await fill('', 'not-an-email', 'long-enough-pass')
    expect(await screen.findByText('Enter your name')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('signs up with display name metadata and the callback redirect', async () => {
    await fill('Jo Buyer', 'jo@x.au', 'long-enough-pass')
    expect(signUp).toHaveBeenCalledWith({
      email: 'jo@x.au',
      password: 'long-enough-pass',
      options: {
        data: { display_name: 'Jo Buyer' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })
    expect(await screen.findByText('Check your email to verify your account')).toBeInTheDocument()
  })

  it('explains an existing account in plain words', async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    await fill('Jo', 'jo@x.au', 'long-enough-pass')
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument()
  })
})
