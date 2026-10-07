'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ReasonDialog } from './ReasonDialog'

type Shop = { id: string; name: string; status: string; listing_cap: number; owner_id: string; owner_status: string }
type Pending = { title: string; confirm: string; url: string; method: 'POST' | 'PATCH'; body?: Record<string, unknown> }

/** Suspend / unsuspend a shop or its owner, and set the shop's listing cap. Every action needs a reason. */
export function ShopAdminControls({ shop }: { shop: Shop }) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const [cap, setCap] = useState(String(shop.listing_cap))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(p: Pending, reason: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(p.url, { method: p.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p.body, reason }) })
      if (res.ok) {
        setPending(null)
        router.refresh()
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: { message: string } }
      setError(j.error?.message ?? 'Action failed')
    } catch {
      setError('Action failed')
    } finally {
      setBusy(false)
    }
  }

  const shopSuspended = shop.status === 'suspended'
  const ownerSuspended = shop.owner_status === 'suspended'
  const capNumber = Number(cap)
  const capValid = Number.isInteger(capNumber) && capNumber >= 1 && capNumber <= 1000 && capNumber !== shop.listing_cap
  const btn = 'rounded border px-3 py-1.5 text-sm disabled:opacity-50'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} className={`${btn} ${shopSuspended ? 'border-green-700 text-green-800' : 'border-red-700 text-red-700'}`}
        onClick={() => setPending(shopSuspended
          ? { title: `Unsuspend ${shop.name}`, confirm: `Unsuspend ${shop.name}`, url: `/api/admin/shops/${shop.id}/unsuspend`, method: 'POST' }
          : { title: `Suspend ${shop.name}`, confirm: `Suspend ${shop.name}`, url: `/api/admin/shops/${shop.id}/suspend`, method: 'POST' })}>
        {shopSuspended ? 'Unsuspend shop' : 'Suspend shop'}
      </button>
      <button type="button" disabled={busy} className={`${btn} border-gray-400`}
        onClick={() => setPending(ownerSuspended
          ? { title: 'Unsuspend the owner', confirm: 'Unsuspend owner account', url: `/api/admin/users/${shop.owner_id}/unsuspend`, method: 'POST' }
          : { title: 'Suspend the owner (and their shop)', confirm: 'Suspend owner account', url: `/api/admin/users/${shop.owner_id}/suspend`, method: 'POST' })}>
        {ownerSuspended ? 'Unsuspend owner' : 'Suspend owner'}
      </button>
      <span className="ml-2 inline-flex items-center gap-2 text-sm">
        <label htmlFor={`cap-${shop.id}`}>Listing cap</label>
        <input id={`cap-${shop.id}`} type="number" min={1} max={1000} value={cap} onChange={(e) => setCap(e.target.value)}
          className="w-20 rounded border border-gray-300 px-2 py-1" />
        <button type="button" disabled={busy || !capValid} className={`${btn} border-gray-400`}
          onClick={() => setPending({ title: `Set ${shop.name}’s listing cap`, confirm: `Set cap to ${capNumber}`, url: `/api/admin/shops/${shop.id}/listing-cap`, method: 'PATCH', body: { listing_cap: capNumber } })}>
          Set cap
        </button>
      </span>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
      {pending && <ReasonDialog title={pending.title} confirmLabel={pending.confirm} busy={busy} hint="Kept in the audit log. 5–500 characters."
        onConfirm={(reason) => void run(pending, reason)} onCancel={() => setPending(null)} />}
    </div>
  )
}
