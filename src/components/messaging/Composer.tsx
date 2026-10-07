'use client'

export const MAX_MESSAGE = 2000

type Props = { value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; max?: number; autoFocus?: boolean }

/** Text box with a live character counter; Send is disabled when empty, over the limit or busy. */
export function Composer({ value, onChange, onSend, busy, max = MAX_MESSAGE, autoFocus = false }: Props) {
  const length = value.length
  const over = length > max
  const empty = value.trim().length === 0
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!over && !empty && !busy) onSend() }} className="space-y-2">
      <label htmlFor="message-body" className="sr-only">Your message</label>
      <textarea id="message-body" value={value} onChange={(e) => onChange(e.target.value)} rows={3} autoFocus={autoFocus}
        aria-describedby="message-count"
        className="w-full resize-y rounded-md border border-[#CBD3DF] px-3 py-2 text-sm text-[#1B2333] focus:border-[#14284B] focus:outline-none" />
      <div className="flex items-center justify-between gap-3">
        <span id="message-count" className={`text-xs ${over ? 'font-semibold text-red-700' : 'text-[#5A6578]'}`}>{length}/{max}</span>
        <button type="submit" disabled={over || empty || busy}
          className="rounded-md bg-[#14284B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E1D38] disabled:opacity-50">
          Send
        </button>
      </div>
    </form>
  )
}
