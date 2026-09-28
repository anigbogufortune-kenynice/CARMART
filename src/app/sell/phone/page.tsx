'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { normaliseAuMobile } from '@/types/domain'

const MESSAGES: Record<string, string> = {
  INVALID_AU_MOBILE: 'Enter an Australian mobile number (04…)',
  PHONE_IN_USE: 'That number is already verified on another account',
  RATE_LIMITED: 'Too many codes requested — try again later',
  INVALID_CODE: 'That code isn’t right',
  UNAUTHENTICATED: 'Sign in to verify your phone',
}
const RESEND_AFTER_S = 60

async function post(url: string, body: unknown): Promise<{ ok: boolean; code?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = (await res.json()) as { data?: unknown; error?: { code: string } }
  return json.data ? { ok: true } : { ok: false, code: json.error?.code }
}

export default function PhonePage() {
  const [phone, setPhone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  // Derive the countdown from a timestamp (accurate even when a background tab throttles timers).
  useEffect(() => {
    if (resendAt <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [resendAt])

  async function send(number: string) {
    setError(null)
    const result = await post('/api/profile/phone/send-code', { phone: number })
    if (!result.ok) return setError(MESSAGES[result.code ?? ''] ?? 'We couldn’t send a code. Try again.')
    setPhone(number)
    setNow(Date.now())
    setResendAt(Date.now() + RESEND_AFTER_S * 1000)
  }

  async function onNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalised = normaliseAuMobile(String(new FormData(event.currentTarget).get('mobile') ?? ''))
    if (!normalised) return setError(MESSAGES.INVALID_AU_MOBILE)
    await send(normalised)
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim()
    const result = await post('/api/profile/phone/verify', { phone, code })
    if (result.ok) setVerified(true)
    else setError(MESSAGES[result.code ?? ''] ?? 'We couldn’t verify that code.')
  }

  if (verified) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Phone verified</h1>
        <p className="mt-3 text-gray-700">Next, submit your shop for approval.</p>
        <Link href="/sell" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white">Back to your checklist</Link>
      </main>
    )
  }

  const input = 'mt-1 w-full rounded border border-gray-300 px-3 py-2'
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Verify your mobile</h1>
      <p className="mt-2 text-sm text-gray-600">We text you a code. Your number is private unless you choose to show it to buyers.</p>
      {!phone ? (
        <form onSubmit={onNumber} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="mobile" className="block text-sm font-medium">Mobile number</label>
            <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="0412 345 678" className={input} />
          </div>
          <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Send code</button>
        </form>
      ) : (
        <form onSubmit={onCode} noValidate className="mt-6 space-y-4">
          <p className="text-sm">Code sent to {phone}.</p>
          <div>
            <label htmlFor="code" className="block text-sm font-medium">6-digit code</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={input} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Verify</button>
            <button type="button" disabled={wait > 0} onClick={() => phone && send(phone)}
              className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50">
              {wait > 0 ? `Resend code (${wait}s)` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </main>
  )
}
