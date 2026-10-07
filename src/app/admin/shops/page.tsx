import type { Metadata } from 'next'
import { ShopAdminControls } from '@/components/admin/ShopAdminControls'
import { ShopDecisionButtons } from '@/components/admin/ShopDecisionButtons'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type ShopAdminItem, type ShopQueueItem } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Shops | CarMart admin' }
export const dynamic = 'force-dynamic'

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
}

export default async function AdminShopsPage({ searchParams }: { searchParams: { page?: string; q?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const q = (searchParams.q ?? '').slice(0, 60)
  const db = createServerSupabase()
  const [res, all] = await Promise.all([listQueue(db, 'shops', page), listQueue(db, 'all-shops', 1, { q })])
  const items = res.ok ? (res.value.items as ShopQueueItem[]) : []
  const shops = all.ok ? (all.value.items as ShopAdminItem[]) : []

  return (
    <main>
      <h1 className="text-2xl font-semibold">Shops waiting for approval</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-gray-600">Nothing to review.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((s) => (
            <li key={s.id} className="rounded border border-gray-200 bg-white p-4">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-600">
                {s.city}, {s.state} · submitted {ago(s.submitted_at)} · owner {s.owner_name} ·{' '}
                {s.phone_verified ? 'phone verified ✓' : 'phone NOT verified'}
              </p>
              <ShopDecisionButtons shopId={s.id} shopName={s.name} />
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="all-shops" className="mt-12">
        <h2 id="all-shops" className="text-xl font-semibold">All shops</h2>
        <form role="search" className="mt-3 flex gap-2" action="/admin/shops">
          <label htmlFor="shop-q" className="sr-only">Search shops by name or web address</label>
          <input id="shop-q" name="q" defaultValue={q} placeholder="Search by name or web address" className="w-full max-w-sm rounded border border-gray-300 px-3 py-2" />
          <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Search</button>
        </form>
        {shops.length === 0 ? <p className="mt-4 text-gray-600">No shops found.</p> : (
          <ul className="mt-4 space-y-3">
            {shops.map((s) => (
              <li key={s.id} className="rounded border border-gray-200 bg-white p-4">
                <p className="font-medium">{s.name} <span className="text-sm font-normal text-gray-600">/{s.slug}</span></p>
                <p className="text-sm text-gray-600">
                  {s.city}, {s.state} · {s.status.replace('_', ' ')} · owner {s.owner_name}{s.owner_status === 'suspended' ? ' (suspended)' : ''} · cap {s.listing_cap}
                </p>
                {s.status_reason && <p className="text-sm text-gray-600">Reason: {s.status_reason}</p>}
                <ShopAdminControls shop={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
