import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getMyShop } from '@/services/shop.service'
import { NewListing } from './NewListing'

export const metadata: Metadata = { title: 'New listing | CarMart' }
export const dynamic = 'force-dynamic'

export default async function NewListingPage() {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect('/sign-in?next=/sell/listings/new')
  const shop = await getMyShop(db)
  if (!shop.ok) redirect('/sell')

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/sell/listings" className="text-sm underline">← Your listings</Link>
      <h1 className="mt-4 text-2xl font-semibold">List a car</h1>
      <p className="mt-2 text-sm text-gray-600">Save a draft at any time. You’ll add photos next, then submit it for checks.</p>
      <NewListing />
    </main>
  )
}
