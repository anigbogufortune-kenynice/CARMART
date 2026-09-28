import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getMyListing } from '@/services/listing.service'
import { LISTING_STATUS_LABELS } from '@/types/domain'
import { EditListing } from './EditListing'

export const metadata: Metadata = { title: 'Edit listing | CarMart' }
export const dynamic = 'force-dynamic'

const EDITABLE = ['draft', 'rejected', 'expired']

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect(`/sign-in?next=/sell/listings/${params.id}`)
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const res = await getMyListing(db, params.id)
  if (!res.ok) notFound()
  const listing = res.value

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/sell/listings" className="text-sm underline">← Your listings</Link>
      <h1 className="mt-4 text-2xl font-semibold">{listing.title}</h1>
      <p className="mt-1 text-sm text-gray-600">Status: {LISTING_STATUS_LABELS[listing.status]}</p>
      {listing.status === 'rejected' && listing.status_reason && (
        <p role="alert" className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Needs changes: {listing.status_reason}</p>
      )}
      {EDITABLE.includes(listing.status) ? (
        <EditListing initial={listing} />
      ) : (
        <p className="mt-6 rounded bg-gray-50 px-4 py-3 text-sm text-gray-800">
          This listing can’t be edited while it is {LISTING_STATUS_LABELS[listing.status].toLowerCase()}.
        </p>
      )}
    </main>
  )
}
