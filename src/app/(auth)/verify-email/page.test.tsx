import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const resend = vi.fn().mockResolvedValue({ error: null })
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { resend } }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('email=a@b.au') }))

import VerifyEmailPage from './page'

describe('verify-email page', () => {
  it('explains verification and resends the email', async () => {
    render(<VerifyEmailPage />)
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resend email' }))
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@b.au',
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
    expect(await screen.findByText('Email sent')).toBeInTheDocument()
  })
})
