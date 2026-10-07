import type { Metadata } from 'next'
import { formatDate } from '@/lib/format'
import { notFound } from 'next/navigation'
import { shopMetadata, siteUrl } from '@/lib/seo'
import { createServerSupabase } from '@/lib/supabase/server'
import { ReportDialog } from '@/components/moderation/ReportDialog'
import { ListingCard } from '@/components/search/ListingCard'
import { searchListings } from '@/services/search.service'
import { getPublicShopBySlug } from '@/services/shop.service'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const shop = await getPublicShopBySlug(createServerSupabase(), params.slug)
  return shop.ok ? shopMetadata(shop.value, siteUrl()) : { title: 'Shop not found | CarMart', robots: { index: false } }
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

const memberSince = (iso: string) =>
  formatDate(iso, { month: 'long', year: 'numeric' })

export default async function PublicShopPage({ params }: { params: { slug: string } }) {
  const db = createServerSupabase()
  const shop = await getPublicShopBySlug(db, params.slug)
  if (!shop.ok) notFound()
  const s = shop.value
  const [cars, { data: auth }] = await Promise.all([
    searchListings(db, { sort: 'newest', page: 1 }, { shopId: s.id }),
    db.auth.getUser(),
  ])
  const items = cars.ok ? cars.value.items : []

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-4">
        <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white">
          {initials(s.name)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{s.name}</h1>
          <p className="text-gray-600">{s.city}, {s.state} · Member since {memberSince(s.created_at)}</p>
          {s.verified && (
            <p className="mt-1 inline-block rounded bg-green-50 px-2 py-0.5 text-sm font-medium text-green-800">✓ Verified shop</p>
          )}
        </div>
      </div>
      {s.description && <p className="mt-6 whitespace-pre-line text-gray-800">{s.description}</p>}
      <div className="mt-4 max-w-[10rem]">
        <ReportDialog targetType="shop" targetId={s.id} signedIn={!!auth.user} returnTo={`/shops/${s.slug}`}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-center text-sm text-gray-700 hover:border-gray-500" />
      </div>
      <section className="mt-10" aria-labelledby="cars-heading">
        <h2 id="cars-heading" className="text-lg font-semibold">Cars for sale</h2>
        {items.length > 0 ? (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((car) => <li key={car.id}><ListingCard car={car} /></li>)}
          </ul>
        ) : (
          <p className="mt-2 text-gray-600">No cars listed yet.</p>
        )}
      </section>
    </main>
  )
}
