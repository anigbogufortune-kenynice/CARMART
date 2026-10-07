import type { Metadata } from 'next'
import { DecisionButtons } from '@/components/admin/DecisionButtons'
import { ListingSummaryCard } from '@/components/admin/ListingSummaryCard'
import { Pagination } from '@/components/search/Pagination'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type ListingQueueItem } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Other make or model | CarMart admin' }
export const dynamic = 'force-dynamic'

/** /admin/other-make-model: listings whose seller typed a make or model that isn't in our list. */
export default async function OtherMakeModelPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const res = await listQueue(createServerSupabase(), 'other-make-model', page)
  const items = res.ok ? (res.value.items as ListingQueueItem[]) : []
  return (
    <main>
      <h1 className="text-2xl font-semibold">Other make or model</h1>
      <p className="mt-1 text-sm text-gray-600">Check the typed make and model match the photos and are a real car.</p>
      {!res.ok && <p role="alert" className="mt-6 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load the queue: {res.error.message}</p>}
      {res.ok && items.length === 0 && <p className="mt-6 text-gray-600">Nothing to review.</p>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <ListingSummaryCard listing={item}>
              <DecisionButtons endpoint={`/api/admin/listings/${item.id}`} approveLabel="Clear flag (looks right)"
                approveAction="clear-flag" approveBody={{ flag: 'other_make_model' }} rejectTitle={`Reject ${item.title}`} />
            </ListingSummaryCard>
          </li>
        ))}
      </ul>
      {res.ok && <Pagination page={page} size={res.value.page.size} total={res.value.page.total} params={{}} basePath="/admin/other-make-model" />}
    </main>
  )
}
