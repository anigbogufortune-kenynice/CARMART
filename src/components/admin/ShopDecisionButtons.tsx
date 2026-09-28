'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ReasonDialog } from './ReasonDialog'

export function ShopDecisionButtons({ shopId, shopName }: { shopId: string; shopName: string }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: 'approve' | 'reject', reason?: string) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/shops/${shopId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { reason } : {}),
    })
    setBusy(false)
    if (!res.ok) {
      const j = (await res.json()) as { error?: { message: string } }
      setError(j.error?.message ?? 'Action failed')
      return
    }
    setRejecting(false)
    router.refresh()
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => decide('approve')} className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
        Approve {shopName}
      </button>
      <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="rounded border border-red-700 px-3 py-1.5 text-sm text-red-700">
        Reject
      </button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
      {rejecting && (
        <ReasonDialog title={`Reject ${shopName}`} confirmLabel="Reject shop" busy={busy}
          onConfirm={(reason) => decide('reject', reason)} onCancel={() => setRejecting(false)} />
      )}
    </div>
  )
}
