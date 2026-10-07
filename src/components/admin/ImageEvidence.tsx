import Link from 'next/link'
import type { ImageQueueItem } from '@/services/moderation.service'

const n2 = (v: number | undefined) => (typeof v === 'number' ? v.toFixed(2) : '?')
const yesNo = (v: boolean | undefined) => (v === undefined ? 'unknown' : v ? 'yes' : 'no')

function exifLine(m: ImageQueueItem['metadata_signals']): string {
  if (!m) return 'EXIF: not recorded'
  if (!m.has_exif) return 'EXIF: none'
  const camera = [m.camera_make, m.camera_model].filter(Boolean).join(' ')
  return `EXIF: ${camera || 'present'}${m.software ? ` · software ${m.software}` : ''}${m.c2pa_present ? ' · C2PA' : ''}`
}

/** One photo in the admin review queue with everything the pipeline found (docs/systems/image-verification.md). */
export function ImageEvidence({ item, children }: { item: ImageQueueItem; children?: React.ReactNode }) {
  const t = item.thresholds ?? {}
  const car = item.car_check
  const publicListing = item.listing.status === 'live' || item.listing.status === 'sold'
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className={`grid gap-3 ${item.phash_match ? 'sm:grid-cols-2' : ''}`}>
        <figure>
          {item.signed_url ? (
            <a href={item.signed_url} target="_blank" rel="noreferrer" aria-label={`Open photo ${item.position + 1} full size`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.signed_url} alt={`Photo ${item.position + 1} under review`} className="max-h-72 w-full rounded object-contain bg-gray-100" />
            </a>
          ) : <div className="flex h-48 items-center justify-center rounded bg-gray-100 text-sm text-gray-600">Photo unavailable</div>}
          <figcaption className="mt-1 text-xs text-gray-600">This photo</figcaption>
        </figure>
        {item.phash_match && (
          <figure>
            {item.phash_match.matched_signed_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.phash_match.matched_signed_url} alt="Earlier matching photo" className="max-h-72 w-full rounded object-contain bg-gray-100" />
              : <div className="flex h-48 items-center justify-center rounded bg-gray-100 text-sm text-gray-600">Matched photo unavailable</div>}
            <figcaption className="mt-1 text-xs text-gray-600">
              Earlier photo from {item.phash_match.matched_shop_name ?? 'another shop'} (distance {item.phash_match.distance})
            </figcaption>
          </figure>
        )}
      </div>
      {item.phash_match && <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">Possible reused photo</p>}
      <ul className="mt-3 space-y-1 text-sm text-gray-800">
        <li>AI score {n2(item.ai_check?.score)} (review ≥ {n2(t.aiReviewThreshold)}, reject ≥ {n2(t.aiRejectThreshold)})</li>
        <li>Car: {yesNo(car?.is_car)} ({n2(car?.confidence)}){car?.view ? `, ${car.view}` : ''}</li>
        <li>Screen/print: {yesNo(car?.is_screen_or_print)}</li>
        <li>{exifLine(item.metadata_signals)}</li>
        {item.decision_reason && <li className="text-gray-600">Seller sees: {item.decision_reason}</li>}
      </ul>
      <p className="mt-3 text-sm">
        {publicListing
          ? <Link href={`/cars/${item.listing.id}`} className="underline">{item.listing.title}</Link>
          : <span className="font-medium">{item.listing.title}</span>}
        <span className="text-gray-600"> · {item.listing.status} · {item.shop.name}</span>
      </p>
      {children}
    </article>
  )
}
