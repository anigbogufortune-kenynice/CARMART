import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithPassword = vi.fn()
const signInWithOAuth = vi.fn()
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signInWithPassword, signInWithOAuth } }) }))
const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

import { AuthForm } from './AuthForm'

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null })
  signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null })
  push.mockReset()
  refresh.mockReset()
})

async function signIn(next?: string) {
  const user = userEvent.setup()
  render(<AuthForm next={next} />)
  await user.type(screen.getByLabelText('Email'), 'jo@x.au')
  await user.type(screen.getByLabelText('Password'), 'long-enough-pass')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('AuthForm (sign-in)', () => {
  it('never reveals which credential was wrong', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    await signIn()
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('sends unverified users to the verify-email page', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Email not confirmed' } })
    await signIn()
    expect(push).toHaveBeenCalledWith('/verify-email?email=jo%40x.au')
  })

  it('goes to next after a successful sign-in', async () => {
    await signIn('/sell')
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'jo@x.au', password: 'long-enough-pass' })
    expect(push).toHaveBeenCalledWith('/sell')
    expect(refresh).toHaveBeenCalled()
  })

  it('defaults next to / and ignores unsafe next values', async () => {
    await signIn('https://evil.com')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('offers Google sign-in through the callback, keeping next', async () => {
    const user = userEvent.setup()
    render(<AuthForm next="/sell" />)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fsell` },
    })
  })
})
