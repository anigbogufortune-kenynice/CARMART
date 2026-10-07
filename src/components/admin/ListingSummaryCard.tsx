import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { ListingSummary } from '@/services/moderation.service'

/** Compact listing card for admin queues: first photo, title, shop, status, VIN, dates. */
export function ListingSummaryCard({ listing, label, children }: { listing: ListingSummary; label?: string; children?: React.ReactNode }) {
  const isPublic = listing.status === 'live' || listing.status === 'sold'
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      {label && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>}
      {listing.photo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={listing.photo_url} alt={`First photo of ${listing.title}`} className="h-44 w-full rounded bg-gray-100 object-cover" />
        : <div className="flex h-44 items-center justify-center rounded bg-gray-100 text-sm text-gray-600">No photo</div>}
      <h3 className="mt-3 font-semibold">
        {isPublic ? <Link href={`/cars/${listing.id}`} className="underline">{listing.title}</Link> : listing.title}
      </h3>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt className="text-gray-600">Shop</dt><dd>{listing.shop.name}</dd>
        <dt className="text-gray-600">Status</dt><dd>{listing.status.replace('_', ' ')}</dd>
        {listing.vin && (<><dt className="text-gray-600">VIN</dt><dd className="font-mono">{listing.vin}</dd></>)}
        {(listing.make_other || listing.model_other) && (
          <><dt className="text-gray-600">Typed in</dt><dd>{[listing.make_other, listing.model_other].filter(Boolean).join(' · ')}</dd></>
        )}
        {listing.submitted_at && (<><dt className="text-gray-600">Submitted</dt><dd>{formatDate(listing.submitted_at)}</dd></>)}
        {listing.live_at && (<><dt className="text-gray-600">Live since</dt><dd>{formatDate(listing.live_at)}</dd></>)}
      </dl>
      {children}
    </article>
  )
}
