import Link from 'next/link'
import { formatNaira } from '@/lib/format'
import type { ListingCard as Card } from '@/services/search.service'
import { CONDITION_LABELS, stateLabel } from '@/types/domain'

const conditionLabel = (c: string | null) => (c && c in CONDITION_LABELS ? CONDITION_LABELS[c as keyof typeof CONDITION_LABELS] : null)

/** One search result: photo, title, price, key facts, place and the verified badge. */
export function ListingCard({ car }: { car: Card }) {
  const facts = [car.odometer_km != null ? `${car.odometer_km.toLocaleString('en-NG')} km` : null, conditionLabel(car.condition)].filter(Boolean)
  return (
    <Link href={`/cars/${car.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E7EF] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(8,18,40,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8924F]">
      <div className="relative aspect-[4/3] bg-[#EEF1F6]">
        {car.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- public WebP variants are already sized (sm = 400px)
          <img src={car.thumbnail_url} alt={car.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#5A6578]">No photo yet</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-snug text-[#1B2333] group-hover:underline">{car.title}</h3>
        <p className="mt-1 text-lg font-bold text-[#14284B]">{formatNaira(car.price_cents)}</p>
        {facts.length > 0 && <p className="mt-1 text-sm text-[#5A6578]">{facts.join(' · ')}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
          <span className="text-[#5A6578]">{[car.city, car.state ? stateLabel(car.state) : null].filter(Boolean).join(', ')}</span>
          {car.shop.verified && (
            <span className="rounded-full bg-[#F4EDE1] px-2 py-0.5 text-xs font-semibold text-[#7A5E2E]">Verified shop</span>
          )}
        </div>
      </div>
    </Link>
  )
}
