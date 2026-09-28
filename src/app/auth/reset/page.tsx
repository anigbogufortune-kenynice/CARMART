'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

type Mode = 'loading' | 'request' | 'update'

/**
 * Two modes: request a reset link (no session), or set a new password after the
 * link has been exchanged for a session by /auth/callback?next=/auth/reset.
 */
export default function ResetPage() {
  const [mode, setMode] = useState<Mode>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => setMode(data.session ? 'update' : 'request'))
  }, [])

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    await createBrowserSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })
    // Same message either way, so the form can't be used to discover accounts.
    setMessage('If an account exists for that email, a reset link is on its way.')
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    if (password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }
    const { error: updateError } = await createBrowserSupabase().auth.updateUser({ password })
    if (updateError) setError('We couldn’t update your password. Request a new link and try again.')
    else setMessage('Password updated')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {mode === 'request' && (
        <form onSubmit={onRequest} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </div>
          <button type="submit" className="w-full rounded bg-gray-900 px-4 py-2 text-white">Send reset link</button>
        </form>
      )}
      {mode === 'update' && (
        <form onSubmit={onUpdate} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" className="w-full rounded bg-gray-900 px-4 py-2 text-white">Update password</button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-green-800">
          {message} {message === 'Password updated' && <Link href="/" className="underline">Continue</Link>}
        </p>
      )}
    </main>
  )
}
