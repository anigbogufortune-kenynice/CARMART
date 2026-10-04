'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Props = { listingId: string; version: number; status: string; blockers: string[] }

/** Submit button (with the reasons it's disabled) and a refresh loop while the checks run. */
export function ListingActions({ listingId, version, status, blockers }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status !== 'checking') return
    const timer = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(timer)
  }, [status, router])

  async function markSold() {
    if (!window.confirm('Mark this car as sold? It leaves search straight away and can’t be put back on sale.')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/listings/${listingId}/mark-sold`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }),
      })
      const json = (await res.json()) as { error?: { message: string } }
      if (!res.ok) setError(json.error?.message ?? 'Couldn’t mark as sold. Try again.')
      router.refresh()
    } catch {
      setError('Couldn’t mark as sold. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'live') {
    return (
      <div className="mt-6 rounded border border-gray-200 p-4">
        <button type="button" onClick={() => void markSold()} disabled={busy}
          className="rounded border border-gray-900 px-4 py-2 text-gray-900 disabled:opacity-50">
          {busy ? 'Saving…' : 'Mark as sold'}
        </button>
        <p className="mt-2 text-sm text-gray-600">Sold the car? Mark it so buyers stop contacting you.</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    )
  }

  if (status !== 'draft' && status !== 'rejected') return null

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/listings/${listingId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }),
      })
      const json = (await res.json()) as { error?: { message: string } }
      if (!res.ok) setError(json.error?.message ?? 'Couldn’t submit. Try again.')
      router.refresh()
    } catch {
      setError('Couldn’t submit. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 rounded border border-gray-200 p-4">
      <button type="button" onClick={() => void submit()} disabled={busy || blockers.length > 0}
        aria-describedby={blockers.length ? 'submit-blockers' : undefined}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Submitting…' : status === 'rejected' ? 'Submit again' : 'Submit listing'}
      </button>
      {blockers.length > 0 ? (
        <ul id="submit-blockers" className="mt-3 list-disc pl-5 text-sm text-gray-700">
          {blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-600">Your photos are checked automatically. The car goes live as soon as they all pass.</p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
