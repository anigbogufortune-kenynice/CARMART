import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type ShopQueueItem } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Shops waiting | CarMart admin' }

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
}

export default async function AdminShopsPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const res = await listQueue(createServerSupabase(), 'shops', page)
  const items = res.ok ? (res.value.items as ShopQueueItem[]) : []

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
                {s.suburb} {s.state} · submitted {ago(s.submitted_at)} · owner {s.owner_name} ·{' '}
                {s.phone_verified ? 'phone verified ✓' : 'phone NOT verified'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
