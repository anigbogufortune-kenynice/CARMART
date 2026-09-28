import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublicShopBySlug } from '@/services/shop.service'

export const metadata: Metadata = { title: 'Car seller | CarMart' }

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })

export default async function PublicShopPage({ params }: { params: { slug: string } }) {
  const shop = await getPublicShopBySlug(createServerSupabase(), params.slug)
  if (!shop.ok) notFound()
  const s = shop.value

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-4">
        <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-xl font-semibold text-white">
          {initials(s.name)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{s.name}</h1>
          <p className="text-gray-600">{s.suburb}, {s.state} · Member since {memberSince(s.created_at)}</p>
          {s.verified && (
            <p className="mt-1 inline-block rounded bg-green-50 px-2 py-0.5 text-sm font-medium text-green-800">✓ Verified shop</p>
          )}
        </div>
      </div>
      {s.description && <p className="mt-6 whitespace-pre-line text-gray-800">{s.description}</p>}
      <section className="mt-10" aria-labelledby="cars-heading">
        <h2 id="cars-heading" className="text-lg font-semibold">Cars for sale</h2>
        <p className="mt-2 text-gray-600">No cars listed yet.</p>
      </section>
    </main>
  )
}
