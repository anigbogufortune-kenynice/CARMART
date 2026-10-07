import { PhotoGallery } from '@/components/listing/PhotoGallery'
import { SaveButton } from '@/components/listing/SaveButton'
import { SpecTable } from '@/components/listing/SpecTable'
import { ShopCard } from '@/components/shop/ShopCard'
import { formatDate, formatNaira } from '@/lib/format'
import type { PublicListingView } from '@/services/search.service'
import { CONDITION_LABELS } from '@/types/domain'

const placeholder = 'w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'

/** Public listing page body (server-rendered; the gallery is the only client part). */
export function ListingDetail({ listing, signedIn = false, saved = false }: { listing: PublicListingView; signedIn?: boolean; saved?: boolean }) {
  const sold = listing.status === 'sold'
  const condition = listing.condition && listing.condition in CONDITION_LABELS
    ? CONDITION_LABELS[listing.condition as keyof typeof CONDITION_LABELS] : null
  return (
    <main className="bg-[#F6F8FB]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {sold && (
          <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-[#14284B] px-5 py-3 text-white">
            <span className="rounded bg-[#B8924F] px-2 py-0.5 text-sm font-bold tracking-wider">SOLD</span>
            <span className="text-sm">This car was sold{listing.sold_at ? ` on ${formatDate(listing.sold_at)}` : ''}.</span>
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <PhotoGallery title={listing.title} photos={listing.photos} />
            <section aria-labelledby="about-heading" className="mt-8 rounded-xl border border-[#E2E7EF] bg-white p-5">
              <h2 id="about-heading" className="text-lg font-semibold text-[#14284B]">About this car</h2>
              {listing.description
                ? <p className="mt-3 whitespace-pre-line leading-relaxed text-[#1B2333]">{listing.description}</p>
                : <p className="mt-3 text-[#5A6578]">The seller hasn’t added a description.</p>}
            </section>
          </div>
          <aside className="space-y-5">
            <div className="rounded-xl border border-[#E2E7EF] bg-white p-5">
              <h1 className="text-2xl font-semibold leading-tight text-[#1B2333]">{listing.title}</h1>
              {condition && <p className="mt-1 text-sm text-[#5A6578]">{condition}</p>}
              <p className="mt-3 text-3xl font-bold text-[#14284B]">{formatNaira(listing.price_cents)}</p>
              {!sold && (
                <div className="mt-5 space-y-2">
                  <button type="button" disabled className={`${placeholder} bg-[#14284B] text-white`}>Message seller</button>
                  <div className="grid grid-cols-2 gap-2">
                    <SaveButton listingId={listing.id} signedIn={signedIn} initialSaved={saved} />
                    <button type="button" disabled className={`${placeholder} border border-[#CBD3DF] bg-white text-[#14284B]`}>Report</button>
                  </div>
                  <p className="text-xs text-[#5A6578]">Messaging the seller opens soon.</p>
                </div>
              )}
            </div>
            <ShopCard shop={listing.shop} />
            <div className="rounded-xl border border-[#E2E7EF] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#14284B]">Specs</h2>
              <div className="mt-2"><SpecTable car={listing} /></div>
            </div>
            <p className="rounded-lg bg-[#F4EDE1] px-4 py-3 text-sm text-[#5A4520]">
              Buy safely: inspect the car and its papers in person, and only pay once you’re satisfied.
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
