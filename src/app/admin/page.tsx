import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue } from '@/services/moderation.service'

export const metadata: Metadata = { title: 'Admin | CarMart' }

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const db = createServerSupabase()
  const [shops, images] = await Promise.all([listQueue(db, 'shops', 1), listQueue(db, 'images', 1)])
  const waiting = shops.ok ? shops.value.page.total : 0
  const photos = images.ok ? images.value.page.total : 0
  return (
    <main>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        <li className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Shops waiting</p>
          <p className="text-3xl font-semibold">{waiting}</p>
          <Link href="/admin/shops" className="text-sm underline">Review shops</Link>
        </li>
        <li className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Photos to review</p>
          <p className="text-3xl font-semibold" aria-label={`Photos to review: ${photos}`}>{photos}</p>
          <Link href="/admin/images" className="text-sm underline">Review photos</Link>
        </li>
      </ul>
    </main>
  )
}
