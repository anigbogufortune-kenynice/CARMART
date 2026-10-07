'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatNgPhone } from '@/lib/format'

type Props = { listingId: string; signedIn: boolean }

const outline = 'block w-full rounded-md border border-[#CBD3DF] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#14284B] hover:border-[#14284B] disabled:opacity-60'

/** Reveals the seller's phone (shops that opted in) to signed-in buyers; visitors are asked to sign in. */
export function ShowPhoneButton({ listingId, signedIn }: Props) {
  const [phone, setPhone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return <Link href={`/sign-in?next=${encodeURIComponent(`/cars/${listingId}`)}`} className={outline}>Sign in to see the phone number</Link>
  }
  if (phone) {
    return <a href={`tel:${phone}`} className={outline}>Call {formatNgPhone(phone)}</a>
  }

  async function reveal() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/listings/${listingId}/phone`)
      const json = (await res.json()) as { data?: { phone: string }; error?: { code: string } }
      if (res.ok && json.data) setPhone(json.data.phone)
      else setError(json.error?.code === 'PHONE_NOT_AVAILABLE'
        ? 'This seller’s number isn’t available. Send them a message instead.'
        : 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <>
      <button type="button" onClick={() => void reveal()} disabled={busy} className={outline}>Show phone</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </>
  )
}
