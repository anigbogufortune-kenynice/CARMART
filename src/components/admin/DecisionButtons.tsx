'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ReasonDialog } from './ReasonDialog'

type Props = { endpoint: string; approveLabel: string; rejectTitle: string }

/**
 * Approve / Reject (with a reason) for an admin queue item: POSTs `${endpoint}/approve|reject`.
 * On success the buttons give way to a short confirmation and the queue refreshes.
 */
export function DecisionButtons({ endpoint, approveLabel, rejectTitle }: Props) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'Approved' | 'Rejected' | null>(null)

  async function decide(action: 'approve' | 'reject', reason?: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${endpoint}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reason ? { reason } : {}),
      })
      if (res.ok) {
        setRejecting(false)
        setDone(action === 'approve' ? 'Approved' : 'Rejected')
        router.refresh()
        return
      }
      const j = (await res.json()) as { error?: { message: string } }
      setError(j.error?.message ?? 'Action failed')
    } catch {
      setError('Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p role="status" className="mt-3 text-sm font-medium text-gray-700">{done} — updating…</p>

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void decide('approve')} className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {approveLabel}
      </button>
      <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="rounded border border-red-700 px-3 py-1.5 text-sm text-red-700">
        Reject
      </button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
      {rejecting && (
        <ReasonDialog title={rejectTitle} confirmLabel={rejectTitle} busy={busy}
          onConfirm={(reason) => void decide('reject', reason)} onCancel={() => setRejecting(false)} />
      )}
    </div>
  )
}
