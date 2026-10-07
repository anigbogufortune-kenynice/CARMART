'use client'

import { useEffect, useId, useRef, useState } from 'react'

/** Modal asking for a 5–500 character reason (reject, remove, suspend…). */
export function ReasonDialog({
  title, confirmLabel, onConfirm, onCancel, busy = false, hint = 'The seller sees this reason. 5–500 characters.',
}: {
  title: string
  confirmLabel: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  busy?: boolean
  hint?: string
}) {
  const [reason, setReason] = useState('')
  const titleId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const trimmed = reason.trim()
  const valid = trimmed.length >= 5 && trimmed.length <= 500

  useEffect(() => inputRef.current?.focus(), [])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
      <div className="w-full max-w-md rounded bg-white p-5 shadow-lg">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <label htmlFor={`${titleId}-reason`} className="mt-4 block text-sm font-medium">Reason</label>
        <textarea id={`${titleId}-reason`} ref={inputRef} value={reason} maxLength={500} rows={4}
          onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        <p className="mt-1 text-xs text-gray-600">{hint}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-1.5">Cancel</button>
          <button type="button" disabled={!valid || busy} onClick={() => onConfirm(trimmed)}
            className="rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
