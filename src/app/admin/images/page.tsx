import type { Metadata } from 'next'
import { DecisionButtons } from '@/components/admin/DecisionButtons'
import { ImageEvidence } from '@/components/admin/ImageEvidence'
import { Pagination } from '@/components/search/Pagination'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type ImageQueueItem } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Photos to review | CarMart admin' }
export const dynamic = 'force-dynamic'

/** /admin/images: photos the pipeline couldn't decide, oldest first, with their evidence. */
export default async function AdminImagesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const res = await listQueue(createServerSupabase(), 'images', page)
  const items = res.ok ? (res.value.items as ImageQueueItem[]) : []
  return (
    <main>
      <h1 className="text-2xl font-semibold">Photos to review</h1>
      <p className="mt-1 text-sm text-gray-600">Signed photo links expire after 10 minutes — reload the page if a photo stops loading.</p>
      {!res.ok && <p role="alert" className="mt-6 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load the queue: {res.error.message}</p>}
      {res.ok && items.length === 0 && <p className="mt-6 text-gray-600">Nothing to review.</p>}
      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <ImageEvidence item={item}>
              <DecisionButtons endpoint={`/api/admin/images/${item.id}`} approveLabel="Approve photo" rejectTitle={`Reject photo ${item.position + 1}`} />
            </ImageEvidence>
          </li>
        ))}
      </ul>
      {res.ok && <Pagination page={page} size={res.value.page.size} total={res.value.page.total} params={{}} basePath="/admin/images" />}
    </main>
  )
}
