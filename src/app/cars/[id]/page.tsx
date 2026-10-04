import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isUuid } from '@/lib/uuid'
import { createServerSupabase } from '@/lib/supabase/server'
import { isSaved } from '@/services/saved.service'
import { getListingForViewer, type ListingView, type PublicListingView } from '@/services/search.service'
import { ListingDetail } from './ListingDetail'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

/** Everyone sees the public page; owners/admins also see their own cars once they're public. */
function toPublic(v: ListingView): PublicListingView | null {
  if (v.status !== 'live' && v.status !== 'sold') return null
  if (v.view === 'public') return v
  const photos = v.photos.flatMap((p) => (p.status === 'passed' && p.urls ? [{ id: p.id, position: p.position, urls: p.urls }] : []))
  return {
    view: 'public', id: v.id, title: v.title, make: v.make, model: v.model, year: v.year, odometer_km: v.odometer_km,
    price_cents: v.price_cents, currency: v.currency, condition: v.condition, body_type: v.body_type, transmission: v.transmission,
    fuel: v.fuel, colour: v.colour, vin: v.vin, description: v.description, state: v.state, city: v.city, status: v.status,
    live_at: v.live_at, sold_at: v.sold_at, expires_at: v.expires_at, shop: v.shop, photos,
  }
}

async function load(id: string): Promise<PublicListingView | null> {
  if (!isUuid(id)) return null
  const res = await getListingForViewer(createServerSupabase(), id)
  return res.ok ? toPublic(res.value) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await load(params.id)
  return { title: listing ? `${listing.title} for sale | CarMart` : 'Car not found | CarMart' }
}

/** /cars/[id]: the public listing page. Anything not publicly visible is a 404. */
export default async function ListingPage({ params }: Props) {
  const listing = await load(params.id)
  if (!listing) notFound()
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  const saved = auth.user ? await isSaved(db, listing.id) : false
  return <ListingDetail listing={listing} signedIn={!!auth.user} saved={saved} />
}
