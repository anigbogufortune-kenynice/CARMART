import Link from 'next/link'

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

export function SellChecklist({ state }: { state: ChecklistState }) {
  return (
    <ol className="mt-6 space-y-3">
      {checklistSteps(state).map((step, i) => (
        <li key={step.key} aria-label={`${step.label} — ${step.done ? 'done' : 'to do'}`}
          className="flex items-center gap-3 rounded border border-gray-200 bg-white px-4 py-3">
          <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step.done ? 'bg-green-700 text-white' : 'bg-gray-200'}`}>
            {step.done ? '✓' : i + 1}
          </span>
          {step.href && !step.done ? (
            <Link href={step.href} className="underline">{step.label}</Link>
          ) : (
            <span className={step.done ? 'text-gray-600' : ''}>{step.label}</span>
          )}
        </li>
      ))}
    </ol>
  )
}
