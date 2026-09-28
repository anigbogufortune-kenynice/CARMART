import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const signOut = vi.fn().mockResolvedValue({ error: null })
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signOut } }) }))
const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

import { SiteHeader } from './SiteHeader'

describe('SiteHeader', () => {
  it('shows Sign in for visitors', () => {
    render(<SiteHeader user={null} />)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it('shows the email and signs members out', async () => {
    render(<SiteHeader user={{ email: 'jo@x.au' }} />)
    expect(screen.getByText('jo@x.au')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/')
  })

  it('links the brand to the home page', () => {
    render(<SiteHeader user={null} />)
    expect(screen.getByRole('link', { name: 'CarMart home' })).toHaveAttribute('href', '/')
  })
})
