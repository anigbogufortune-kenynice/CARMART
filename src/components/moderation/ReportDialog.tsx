'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

type Target = 'listing' | 'shop' | 'conversation'
type Props = { targetType: Target; targetId: string; signedIn: boolean; returnTo: string; className?: string }

const REASONS: { value: string; label: string }[] = [
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'not_a_car', label: 'Not a car for sale' },
  { value: 'ai_or_fake_photos', label: 'AI-made or fake photos' },
  { value: 'wrong_details', label: 'Wrong details (price, mileage, VIN…)' },
  { value: 'offensive', label: 'Offensive or abusive' },
  { value: 'other', label: 'Something else' },
]

const ERRORS: Record<string, string> = {
  ALREADY_REPORTED: 'You’ve already reported this',
  REPORT_LIMIT: 'You’ve sent the maximum number of reports for today. Try again tomorrow.',
  NOT_FOUND: 'This is no longer available',
}

const outline = 'w-full rounded-md border border-[#CBD3DF] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#14284B] hover:border-[#14284B]'

/** "Report" button + dialog: a reason (required) and an optional note. Visitors are asked to sign in. */
export function ReportDialog({ targetType, targetId, signedIn, returnTo, className = outline }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const titleId = useId()
  const firstRadio = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) firstRadio.current?.focus() }, [open])

  if (!signedIn) return <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`} className={`block ${className}`}>Report</Link>
  if (sent) return <p role="status" className="text-sm text-[#1B2333]">Thanks — our team will review this</p>

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) }),
      })
      if (res.ok) {
        setOpen(false)
        setSent(true)
        return
      }
      const j = (await res.json()) as { error?: { code: string } }
      setError(ERRORS[j.error?.code ?? ''] ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>Report</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
          <form className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg" onSubmit={(e) => { e.preventDefault(); if (reason && !busy) void submit() }}>
            <h2 id={titleId} className="text-lg font-semibold text-[#14284B]">Report this {targetType === 'shop' ? 'shop' : targetType === 'listing' ? 'car' : 'conversation'}</h2>
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium text-[#1B2333]">What’s wrong?</legend>
              {REASONS.map((r, i) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-[#1B2333]">
                  <input ref={i === 0 ? firstRadio : undefined} type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${titleId}-note`} className="mt-4 block text-sm font-medium text-[#1B2333]">Anything else we should know? (optional)</label>
            <textarea id={`${titleId}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
              className="mt-1 w-full rounded-md border border-[#CBD3DF] px-3 py-2 text-sm" />
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[#CBD3DF] px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={!reason || busy} className="rounded-md bg-[#14284B] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Send report</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
