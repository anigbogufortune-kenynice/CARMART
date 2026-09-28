'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const email = useSearchParams().get('email') ?? ''
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle')

  async function resend() {
    const { error } = await createBrowserSupabase().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
    setState(error ? 'error' : 'sent')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="mt-3 text-gray-700">
        You need to verify your email before you can message sellers, save cars, report listings or open a shop.
        {email && <> We sent a link to <strong>{email}</strong>.</>}
      </p>
      {email && (
        <button type="button" onClick={resend} className="mt-6 rounded bg-gray-900 px-4 py-2 text-white">
          Resend email
        </button>
      )}
      {state === 'sent' && <p role="status" className="mt-3 text-sm text-green-800">Email sent</p>}
      {state === 'error' && <p role="alert" className="mt-3 text-sm text-red-700">We couldn&apos;t send the email. Try again in a minute.</p>}
    </main>
  )
}
