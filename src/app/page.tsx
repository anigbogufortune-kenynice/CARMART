import { HomeView } from '@/components/home/HomeView'
import { createServerSupabase } from '@/lib/supabase/server'
import { listMakes } from '@/services/listing.service'
import { searchListings } from '@/services/search.service'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = createServerSupabase()
  const [makes, latest] = await Promise.all([listMakes(db), searchListings(db, { sort: 'newest', page: 1 })])
  return <HomeView makes={makes.ok ? makes.value : []} latest={latest.ok ? latest.value.items.slice(0, 12) : []} />
}
