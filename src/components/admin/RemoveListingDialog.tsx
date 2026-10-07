'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ReasonDialog } from './ReasonDialog'

/** Admin "Remove listing" (terminal): asks for a reason the seller will see, then POSTs remove. */
export function RemoveListingDialog({ listingId, title }: { listingId: string; title: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  async function remove(reason: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/remove`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      if (res.ok) {
        setOpen(false)
        setRemoved(true)
        router.refresh()
        return
      }
      const j = (await res.json()) as { error?: { message: string } }
      setError(j.error?.message ?? 'Couldn’t remove the listing')
    } catch {
      setError('Couldn’t remove the listing')
    } finally {
      setBusy(false)
    }
  }

  if (removed) return <p role="status" className="mt-3 text-sm font-medium text-red-800">Listing removed</p>
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(true)} className="rounded border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
        Remove listing
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {open && <ReasonDialog title={`Remove ${title}`} confirmLabel={`Remove ${title}`} busy={busy}
        onConfirm={(reason) => void remove(reason)} onCancel={() => setOpen(false)} />}
    </div>
  )
}
