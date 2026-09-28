import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { listMine } from '@/services/listing.service'
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/types/domain'

export const metadata: Metadata = { title: 'Your listings | CarMart' }
export const dynamic = 'force-dynamic'

const CHIP: Record<ListingStatus, string> = {
  draft: 'bg-gray-100 text-gray-800', checking: 'bg-blue-50 text-blue-900', in_review: 'bg-amber-50 text-amber-900',
  rejected: 'bg-red-50 text-red-900', live: 'bg-green-50 text-green-900', sold: 'bg-purple-50 text-purple-900',
  expired: 'bg-gray-100 text-gray-700', removed: 'bg-red-100 text-red-900',
}

const aud = (cents: number | null) =>
  cents == null ? '—' : (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })

export default async function SellListingsPage() {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect('/sign-in?next=/sell/listings')
  const res = await listMine(db, { page: 1 })
  if (!res.ok) redirect('/sell')
  const { items, page } = res.value

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your listings</h1>
          <p className="mt-1 text-sm text-gray-600">{page.total === 1 ? '1 car' : `${page.total} cars`}</p>
        </div>
        <Link href="/sell/listings/new" className="rounded bg-gray-900 px-4 py-2 text-white">New listing</Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-lg font-medium">No cars listed yet</p>
          <p className="mt-2 text-sm text-gray-600">Start a draft now. You can add photos and submit it when you’re ready.</p>
        </div>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <caption className="sr-only">Your car listings</caption>
          <thead className="border-b border-gray-200 text-gray-600">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Car</th>
              <th scope="col" className="py-2 pr-4 font-medium">Price</th>
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <Link href={`/sell/listings/${l.id}`} className="font-medium underline-offset-2 hover:underline">{l.title}</Link>
                </td>
                <td className="py-3 pr-4 tabular-nums">{aud(l.price_cents)}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[l.status]}`}>{LISTING_STATUS_LABELS[l.status]}</span>
                </td>
                <td className="py-3 text-gray-600">{day(l.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
