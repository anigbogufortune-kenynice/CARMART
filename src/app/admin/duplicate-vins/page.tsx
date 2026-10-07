import type { Metadata } from 'next'
import { ListingSummaryCard } from '@/components/admin/ListingSummaryCard'
import { Pagination } from '@/components/search/Pagination'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type ListingQueueItem } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Duplicate VINs | CarMart admin' }
export const dynamic = 'force-dynamic'

/** /admin/duplicate-vins: each held listing next to the listing(s) already using its VIN. */
export default async function DuplicateVinsPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const res = await listQueue(createServerSupabase(), 'duplicate-vins', page)
  const items = res.ok ? (res.value.items as ListingQueueItem[]) : []
  return (
    <main>
      <h1 className="text-2xl font-semibold">Duplicate VINs</h1>
      <p className="mt-1 text-sm text-gray-600">Compare the photos, shops and dates. Copied photos or a brand-new shop are common scam signs.</p>
      {!res.ok && <p role="alert" className="mt-6 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load the queue: {res.error.message}</p>}
      {res.ok && items.length === 0 && <p className="mt-6 text-gray-600">Nothing to review.</p>}
      <ul className="mt-6 space-y-6">
        {items.map((item) => (
          <li key={item.id} className="grid gap-4 md:grid-cols-2">
            <ListingSummaryCard listing={item} label="Held for review" />
            <div className="space-y-4">
              {item.others.length === 0
                ? <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">The other listing with this VIN is no longer active.</p>
                : item.others.map((o) => <ListingSummaryCard key={o.id} listing={o} label="Also using this VIN" />)}
            </div>
          </li>
        ))}
      </ul>
      {res.ok && <Pagination page={page} size={res.value.page.size} total={res.value.page.total} params={{}} basePath="/admin/duplicate-vins" />}
    </main>
  )
}
