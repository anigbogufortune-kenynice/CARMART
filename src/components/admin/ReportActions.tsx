'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ReasonDialog } from './ReasonDialog'

type Mode = 'dismiss' | 'restore' | 'action'
const DIALOG: Record<Mode, { title: string; confirm: string }> = {
  dismiss: { title: 'Dismiss these reports', confirm: 'Dismiss reports' },
  restore: { title: 'Dismiss the reports and put the listing back', confirm: 'Dismiss and restore' },
  action: { title: 'Close these reports as actioned', confirm: 'Close as actioned' },
}

async function post(url: string, body: object): Promise<string | null> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (res.ok) return null
  const j = (await res.json().catch(() => ({}))) as { error?: { message: string } }
  return j.error?.message ?? 'Action failed'
}

/**
 * Close a reported target's open reports. 'Dismiss & restore listing' (a listing hidden by reports)
 * dismisses, then clears the reports_threshold flag so the listing re-evaluates (→ live).
 */
export function ReportActions({ reportId, restoreListingId }: { reportId: string; restoreListingId?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function run(m: Mode, reason: string) {
    setBusy(true)
    setError(null)
    try {
      let problem = await post(`/api/admin/reports/${reportId}/${m === 'action' ? 'action' : 'dismiss'}`, { reason })
      if (!problem && m === 'restore' && restoreListingId) {
        problem = await post(`/api/admin/listings/${restoreListingId}/clear-flag`, { flag: 'reports_threshold', reason })
      }
      if (problem) setError(problem)
      else {
        setMode(null)
        setDone(true)
        router.refresh()
      }
    } catch {
      setError('Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p role="status" className="mt-3 text-sm font-medium text-gray-700">Done — updating…</p>
  const btn = 'rounded border px-3 py-1.5 text-sm'
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {restoreListingId && (
        <button type="button" disabled={busy} onClick={() => setMode('restore')} className={`${btn} border-green-700 bg-green-700 text-white`}>Dismiss &amp; restore listing</button>
      )}
      <button type="button" disabled={busy} onClick={() => setMode('dismiss')} className={`${btn} border-gray-400`}>Dismiss</button>
      <button type="button" disabled={busy} onClick={() => setMode('action')} className={`${btn} border-red-700 text-red-700`}>Mark actioned</button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
      {mode && <ReasonDialog title={DIALOG[mode].title} confirmLabel={DIALOG[mode].confirm} busy={busy} hint="Kept in the audit log with the reports. 5–500 characters."
        onConfirm={(reason) => void run(mode, reason)} onCancel={() => setMode(null)} />}
    </div>
  )
}
