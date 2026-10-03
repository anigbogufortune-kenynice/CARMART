import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ListingStatusBanner } from '@/components/listing/ListingStatusBanner'
import { isUuid } from '@/lib/uuid'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPhotoStatus } from '@/services/image-upload.service'
import { getMyListing, type OwnListing } from '@/services/listing.service'
import { getMyShop } from '@/services/shop.service'
import { LISTING_STATUS_LABELS } from '@/types/domain'
import { EditListing } from './EditListing'
import { ListingActions } from './ListingActions'
import { PhotosSection } from './PhotosSection'

export const metadata: Metadata = { title: 'Edit listing | CarMart' }
export const dynamic = 'force-dynamic'

const EDITABLE = ['draft', 'rejected', 'expired']
/** Photos can be added while the listing is editable, and to a live listing (docs/api-contracts.md). */
const PHOTOS_EDITABLE = [...EDITABLE, 'live']
const MIN_PHOTOS = 4

const REQUIRED: [string, (l: OwnListing) => unknown][] = [
  ['make', (l) => l.make_id ?? l.make_other], ['model', (l) => l.model_id ?? l.model_other], ['year', (l) => l.year],
  ['odometer', (l) => l.odometer_km], ['price', (l) => l.price_cents], ['body type', (l) => l.body_type],
  ['transmission', (l) => l.transmission], ['fuel', (l) => l.fuel], ['colour', (l) => l.colour], ['VIN', (l) => l.vin],
  ['city or area', (l) => l.city], ['state', (l) => l.state], ['condition', (l) => l.condition],
]

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect(`/sign-in?next=/sell/listings/${params.id}`)
  if (!isUuid(params.id)) notFound()
  const res = await getMyListing(db, params.id)
  if (!res.ok) notFound()
  const listing = res.value
  const [photosRes, shopRes] = await Promise.all([getPhotoStatus(db, listing.id), getMyShop(db)])
  const photos = photosRes.ok ? photosRes.value : []

  const blockers: string[] = []
  if (!shopRes.ok || shopRes.value.status !== 'approved') blockers.push('Your shop must be approved before listings can go live')
  const missing = REQUIRED.filter(([, get]) => get(listing) == null).map(([name]) => name)
  if (missing.length) blockers.push(`Complete these fields: ${missing.join(', ')}`)
  const usable = photos.filter((p) => p.status !== 'uploaded')
  if (usable.length < MIN_PHOTOS) blockers.push(`Add at least ${MIN_PHOTOS} photos (you have ${usable.length})`)
  if (photos.some((p) => p.status === 'rejected')) blockers.push('Delete or replace the rejected photos')

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/sell/listings" className="text-sm underline">← Your listings</Link>
      <h1 className="mt-4 text-2xl font-semibold">{listing.title}</h1>
      <p className="mt-1 text-sm text-gray-600">Status: {LISTING_STATUS_LABELS[listing.status]}</p>
      <ListingStatusBanner status={listing.status} statusReason={listing.status_reason} reviewFlags={listing.review_flags}
        liveAt={listing.live_at} photos={photos} />
      <ListingActions listingId={listing.id} version={listing.version} status={listing.status} blockers={blockers} />
      {EDITABLE.includes(listing.status) ? (
        <EditListing initial={listing} />
      ) : (
        <p className="mt-6 rounded bg-gray-50 px-4 py-3 text-sm text-gray-800">
          This listing can’t be edited while it is {LISTING_STATUS_LABELS[listing.status].toLowerCase()}.
        </p>
      )}
      <PhotosSection listingId={listing.id} editable={PHOTOS_EDITABLE.includes(listing.status)} />
    </main>
  )
}
