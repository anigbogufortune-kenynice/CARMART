import { HomeView } from '@/components/home/HomeView'
import { createServerSupabase } from '@/lib/supabase/server'
import { listMakes } from '@/services/listing.service'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const makes = await listMakes(createServerSupabase())
  return <HomeView makes={makes.ok ? makes.value : []} />
}
