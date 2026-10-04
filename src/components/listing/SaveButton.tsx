'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = { listingId: string; signedIn: boolean; initialSaved: boolean }

/** Heart toggle on a listing page. Visitors are sent to sign in first, then back to the car. */
export function SaveButton({ listingId, signedIn, initialSaved }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/cars/${listingId}`)}`)
      return
    }
    setBusy(true)
    const next = !saved
    setSaved(next)
    try {
      const res = next
        ? await fetch('/api/saved-listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: listingId }) })
        : await fetch(`/api/saved-listings/${listingId}`, { method: 'DELETE' })
      if (!res.ok) setSaved(!next)
    } catch {
      setSaved(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={saved}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-[#CBD3DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#14284B] hover:border-[#14284B] disabled:opacity-60">
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? '#B8924F' : 'none'} stroke={saved ? '#B8924F' : 'currentColor'} strokeWidth="2">
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z" />
      </svg>
      Save
    </button>
  )
}
