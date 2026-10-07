'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type ChecklistState = { hasShop: boolean; phoneVerified: boolean; shopStatus: string | null }
export type ChecklistStep = { key: 'shop' | 'phone' | 'submit' | 'approved'; label: string; href: string | null; done: boolean }

export function checklistSteps(s: ChecklistState): ChecklistStep[] {
  const submitted = s.shopStatus === 'pending_approval' || s.shopStatus === 'approved'
  return [
    { key: 'shop', label: 'Create your shop', href: '/sell/shop', done: s.hasShop },
    { key: 'phone', label: 'Verify your phone', href: '/sell/phone', done: s.phoneVerified },
    { key: 'submit', label: 'Submit for approval', href: null, done: submitted },
    { key: 'approved', label: 'Approved by CarMart', href: null, done: s.shopStatus === 'approved' },
  ]
}

const SUBMIT_ERRORS: Record<string, string> = {
  PHONE_NOT_VERIFIED: 'Verify your phone first',
  INVALID_STATE: 'Your shop can’t be submitted right now',
}

async function submitShop(): Promise<string | null> {
  const res = await fetch('/api/shops/me/submit', { method: 'POST' })
  if (res.ok) return null
  const j = (await res.json()) as { error?: { code: string } }
  return SUBMIT_ERRORS[j.error?.code ?? ''] ?? 'Something went wrong. Please try again.'
}

export function SellChecklist({ state, onSubmit }: { state: ChecklistState; onSubmit?: () => void | Promise<void> }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canSubmit = state.hasShop && state.phoneVerified && (state.shopStatus === 'draft' || state.shopStatus === 'rejected')

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    if (onSubmit) await onSubmit()
    else {
      const problem = await submitShop()
      if (problem) setError(problem)
      else router.refresh()
    }
    setBusy(false)
  }

  return (
    <>
      <ol className="mt-6 space-y-3">
        {checklistSteps(state).map((step, i) => (
          <li key={step.key} aria-label={`${step.label} — ${step.done ? 'done' : 'to do'}`}
            className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white px-4 py-3">
            <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.done ? 'bg-green-700 text-white' : 'bg-gray-200'}`}>
              {step.done ? '✓' : i + 1}
            </span>
            {step.href && !step.done ? (
              <Link href={step.href} className="underline">{step.label}</Link>
            ) : (
              <span className={step.done ? 'text-gray-600' : ''}>{step.label}</span>
            )}
            {step.key === 'submit' && state.shopStatus === 'pending_approval' && (
              <span className="ml-auto text-sm text-amber-800">Waiting for approval</span>
            )}
            {step.key === 'submit' && state.hasShop && !step.done && (
              <span className="ml-auto flex items-center gap-2">
                {!state.phoneVerified && <span className="text-sm text-gray-600">Verify your phone first</span>}
                <button type="button" onClick={handleSubmit} disabled={!canSubmit || busy}
                  className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50">
                  {state.shopStatus === 'rejected' ? 'Resubmit' : 'Submit for approval'}
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {state.shopStatus === 'approved' && (
        <section className="mt-6 rounded-lg border border-[#14284B]/20 bg-[#14284B]/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#14284B]">Your shop is approved</h2>
          <p className="mt-1 text-sm text-gray-700">Add your cars with at least 4 photos each. They go live once the photos pass our checks.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/sell/listings/new" className="rounded-md bg-[#14284B] px-4 py-2 font-medium text-white hover:bg-[#0E1D38]">Add a car</Link>
            <Link href="/sell/listings" className="rounded-md border border-[#14284B] px-4 py-2 font-medium text-[#14284B] hover:bg-white">My cars</Link>
            <Link href="/sell/messages" className="rounded-md border border-[#14284B] px-4 py-2 font-medium text-[#14284B] hover:bg-white">Buyer messages</Link>
          </div>
        </section>
      )}
    </>
  )
}
