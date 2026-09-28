'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

/** Same-site relative paths only (mirrors /auth/callback). */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

export function AuthForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const target = safeNext(next)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!email || !password) {
      setError('Enter your email and password')
      return
    }
    setBusy(true)
    const { error: signInError } = await createBrowserSupabase().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (!signInError) {
      router.push(target)
      router.refresh()
      return
    }
    if (/not confirmed/i.test(signInError.message)) {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      return
    }
    setError('Email or password is incorrect')
  }

  async function onGoogle() {
    await createBrowserSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}` },
    })
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <p role="status" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60">
          Sign in
        </button>
      </form>
      <button type="button" onClick={onGoogle} className="w-full rounded border border-gray-300 px-4 py-2">
        Continue with Google
      </button>
      <p className="text-sm">
        <Link href="/auth/reset" className="underline">Forgot your password?</Link>
        <span className="mx-2 text-gray-400">·</span>
        <Link href="/sign-up" className="underline">Create an account</Link>
      </p>
    </div>
  )
}
