import type { Metadata } from 'next'
import Link from 'next/link'
import { FilterPanel, SortSelect } from '@/components/search/FilterPanel'
import { ListingCard } from '@/components/search/ListingCard'
import { Pagination } from '@/components/search/Pagination'
import { createServerSupabase } from '@/lib/supabase/server'
import { listMakes } from '@/services/listing.service'
import { searchListings } from '@/services/search.service'
import { SearchQuerySchema, type SearchQuery } from '@/types/domain'

export const metadata: Metadata = { title: 'Cars for sale in Nigeria | CarMart' }
export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>

/** Single string values only; anything the schema rejects falls back to "no filters". */
function readQuery(searchParams: Params): { query: SearchQuery; current: Record<string, string> } {
  const current = Object.fromEntries(
    Object.entries(searchParams).flatMap(([k, v]) => (typeof v === 'string' && v !== '' ? [[k, v]] : [])),
  )
  const parsed = SearchQuerySchema.safeParse(current)
  return parsed.success ? { query: parsed.data, current } : { query: { sort: 'newest', page: 1 }, current: {} }
}

/** /cars: server-rendered results for the filters in the URL. */
export default async function CarsPage({ searchParams }: { searchParams: Params }) {
  const db = createServerSupabase()
  const { query, current } = readQuery(searchParams)
  const [makes, results] = await Promise.all([listMakes(db), searchListings(db, query)])
  const page = results.ok ? results.value : { items: [], page: { number: query.page, size: 24, total: 0 } }
  const filtered = Object.keys(current).some((k) => k !== 'sort' && k !== 'page')
  const total = page.page.total

  return (
    <main className="min-h-[70vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#14284B] sm:text-3xl">Cars for sale</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside aria-label="Search filters">
            <FilterPanel key={JSON.stringify(current)} makes={makes.ok ? makes.value : []} current={current} />
          </aside>
          <section aria-labelledby="results-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="results-heading" className="text-[15px] text-[#5A6578]" aria-live="polite">
                {total === 0 ? 'No cars found' : `${total.toLocaleString('en-NG')} ${total === 1 ? 'car' : 'cars'} found`}
              </h2>
              <SortSelect key={current.sort ?? 'newest'} current={current} />
            </div>
            {!results.ok && (
              <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">
                Search isn’t working right now. Please try again in a minute.
              </p>
            )}
            {page.items.length > 0 ? (
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {page.items.map((car) => <li key={car.id}><ListingCard car={car} /></li>)}
              </ul>
            ) : results.ok && (
              <div className="mt-6 rounded-xl border border-dashed border-[#CBD3DF] bg-white px-6 py-12 text-center">
                <p className="text-lg font-semibold text-[#14284B]">{filtered ? 'No cars match these filters' : 'No cars listed yet'}</p>
                <p className="mt-2 text-[#5A6578]">
                  {filtered ? 'Try a wider price range or another state.' : 'Sellers are adding cars now. Check back soon.'}
                </p>
                {filtered ? (
                  <Link href="/cars" className="mt-5 inline-block rounded-md bg-[#14284B] px-5 py-2.5 font-semibold text-white">Clear filters</Link>
                ) : (
                  <Link href="/sell" className="mt-5 inline-block rounded-md bg-[#14284B] px-5 py-2.5 font-semibold text-white">Sell your car</Link>
                )}
              </div>
            )}
            <Pagination page={page.page.number} size={page.page.size} total={total} params={current} />
          </section>
        </div>
      </div>
    </main>
  )
}
