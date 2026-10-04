import type { ImageStatus, ListingStatus } from '@/types/domain'
import { formatDate } from '@/lib/format'

type Props = {
  status: ListingStatus
  statusReason: string | null
  reviewFlags: string[]
  liveAt: string | null
  soldAt?: string | null
  expiresAt?: string | null
  photos: { status: ImageStatus | string; status_reason: string | null }[]
}

/** Seller-facing explanation of why a listing is where it is (docs/systems/listing-lifecycle.md). */
const FLAG_TEXT: Record<string, string> = {
  duplicate_vin: 'We’re checking this car’s VIN — usually within a day',
  other_make_model: 'We’re checking the make and model you entered — usually within a day',
  reports_threshold: 'This listing is being reviewed after reports from buyers',
}
const PHOTO_REVIEW = 'Some photos are being double-checked — usually within a day'
const PHOTOS_REJECTED = 'One or more photos were rejected'

const day = (iso: string) => formatDate(iso)

export function ListingStatusBanner({ status, statusReason, reviewFlags, liveAt, soldAt = null, photos }: Props) {
  const box = 'mt-4 rounded px-4 py-3 text-sm'
  if (status === 'checking') {
    return <p role="status" className={`${box} bg-blue-50 text-blue-900`}>Checking your photos… This usually takes under a minute.</p>
  }
  if (status === 'live') {
    return <p role="status" className={`${box} bg-green-50 text-green-900`}>Live since {liveAt ? day(liveAt) : 'today'}. Buyers can find this car now.</p>
  }
  if (status === 'in_review') {
    const lines = reviewFlags.map((f) => FLAG_TEXT[f]).filter(Boolean)
    if (photos.some((p) => p.status === 'in_review')) lines.push(PHOTO_REVIEW)
    return (
      <div role="status" className={`${box} bg-amber-50 text-amber-900`}>
        <p className="font-medium">In review</p>
        <ul className="mt-1 list-disc pl-5">{(lines.length ? lines : ['Our team is checking this listing — usually within a day']).map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    )
  }
  if (status === 'rejected') {
    const rejected = photos.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.status === 'rejected')
    const photoRejection = statusReason === PHOTOS_REJECTED || (!statusReason && rejected.length > 0)
    return (
      <div role="alert" className={`${box} bg-red-50 text-red-900`}>
        <p className="font-medium">{photoRejection ? 'Some photos were rejected' : 'Needs changes'}</p>
        {!photoRejection && statusReason && <p className="mt-1">{statusReason}</p>}
        {rejected.length > 0 && (
          <ul className="mt-1 list-disc pl-5">{rejected.map((p) => <li key={p.n}>Photo {p.n}: {p.status_reason}</li>)}</ul>
        )}
        <p className="mt-2">Delete or replace the rejected photos, then submit again.</p>
      </div>
    )
  }
  if (status === 'expired') return <p role="status" className={`${box} bg-gray-100 text-gray-800`}>This listing has expired.</p>
  if (status === 'sold') {
    return (
      <p role="status" className={`${box} bg-purple-50 text-purple-900`}>
        {soldAt ? `Sold on ${day(soldAt)}. Buyers can still open it for 7 days.` : 'Marked as sold.'}
      </p>
    )
  }
  if (status === 'removed') {
    return <p role="alert" className={`${box} bg-red-100 text-red-900`}>Removed by CarMart{statusReason ? `: ${statusReason}` : '.'}</p>
  }
  return null
}
