import '@fontsource-variable/archivo/wdth.css'
import Link from 'next/link'
import { ListingCard } from '@/components/search/ListingCard'
import type { ListingCard as Card } from '@/services/search.service'
import { BODY_TYPES, BODY_TYPE_LABELS, CONDITIONS, CONDITION_LABELS, NG_STATES, stateLabel } from '@/types/domain'

/**
 * CarMart home: search first (like the big car marketplaces), then browsing shortcuts,
 * what makes CarMart different, a seller prompt and the footer.
 * Palette: bottle green #14284B (the only dark band), brass #B8924F accents, stone #FFFFFF, white.
 */

export type HomeMake = { id: string; name: string }

const POPULAR = ['Toyota', 'Lexus', 'Honda', 'Mercedes-Benz', 'Hyundai', 'Kia', 'Ford', 'Nissan', 'Acura', 'Peugeot', 'Innoson', 'Land Rover']
/** Naira; sent to search in kobo. */
const PRICES = [2_000_000, 5_000_000, 10_000_000, 20_000_000, 30_000_000, 50_000_000, 100_000_000]
const display = { fontFamily: "'Archivo Variable', var(--font-geist-sans), sans-serif", fontStretch: '125%' } as const

const field = 'mt-1 block w-full rounded-md border border-[#CBD3DF] bg-white px-3 py-2.5 text-[15px] text-[#1B2333] focus:border-[#14284B] focus:outline-none focus:ring-2 focus:ring-[#B8924F]/40'
const label = 'block text-[13px] font-medium text-[#5A6578]'

function SearchPanel({ makes }: { makes: HomeMake[] }) {
  return (
    <form action="/cars" method="get" role="search" aria-label="Search cars"
      className="rounded-xl bg-white p-5 shadow-[0_24px_48px_-28px_rgba(8,18,40,0.6)] sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="search-make" className={label}>Make</label>
          <select id="search-make" name="make_id" defaultValue="" className={field}>
            <option value="">Any make</option>
            {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="search-condition" className={label}>Condition</label>
          <select id="search-condition" name="condition" defaultValue="" className={field}>
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="search-price" className={label}>Price up to</label>
          <select id="search-price" name="price_max" defaultValue="" className={field}>
            <option value="">Any price</option>
            {PRICES.map((p) => <option key={p} value={p * 100}>{`₦${p.toLocaleString('en-NG')}`}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="search-state" className={label}>State</label>
          <select id="search-state" name="state" defaultValue="" className={field}>
            <option value="">All of Nigeria</option>
            {NG_STATES.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
          </select>
        </div>
        <button type="submit"
          className="h-[46px] rounded-md bg-[#14284B] px-6 font-semibold text-white hover:bg-[#0E1D38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8924F] sm:col-span-2 lg:col-span-1">
          Search cars
        </button>
      </div>
    </form>
  )
}

const REASONS = [
  {
    title: 'Every seller is verified',
    body: 'Shops confirm a Nigerian mobile number and are approved by our team before any car goes on sale.',
  },
  {
    title: 'Real photos of the real car',
    body: 'Each photo is checked before it’s shown. AI-made images, stock photos and pictures copied from other sellers are refused.',
  },
  {
    title: 'History you can check',
    body: 'Every listing shows the VIN, so you can check the car’s history before you pay. For foreign used cars, a Carfax report shows past accidents and mileage.',
  },
]

export function HomeView({ makes, latest = [] }: { makes: HomeMake[]; latest?: Card[] }) {
  const byName = new Map(makes.map((m) => [m.name, m.id]))
  const popular = POPULAR.filter((n) => byName.has(n))

  return (
    <main className="bg-[#FFFFFF] text-[#1B2333]">
      <section className="bg-[#14284B]">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:pb-16 sm:pt-20">
          <h1 style={display} className="text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.01em] text-white sm:text-[3.5rem]">
            Find your next car.
          </h1>
          <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-[#C8D4E6]">
            From Nigerian sellers we’ve verified, with every photo checked before you see it.
          </p>
          <div className="mt-9">
            <SearchPanel makes={makes} />
          </div>
        </div>
      </section>

      <section aria-labelledby="body-heading" className="mx-auto max-w-6xl px-4 pt-14">
        <h2 id="body-heading" style={display} className="text-xl font-semibold text-[#14284B]">Browse by body type</h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BODY_TYPES.map((b) => (
            <li key={b}>
              <Link href={`/cars?body_type=${b}`}
                className="block rounded-lg border border-[#DDE3EC] bg-[#F7F9FC] px-4 py-4 font-medium text-[#1B2333] hover:border-[#14284B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8924F]">
                {BODY_TYPE_LABELS[b]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {popular.length > 0 && (
        <section aria-labelledby="makes-heading" className="mx-auto max-w-6xl px-4 pt-12">
          <h2 id="makes-heading" style={display} className="text-xl font-semibold text-[#14284B]">Popular makes</h2>
          <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {popular.map((name) => (
              <li key={name}>
                <Link href={`/cars?make_id=${byName.get(name)}`}
                  className="text-[17px] text-[#1B2333] underline decoration-[#B8924F]/50 decoration-2 underline-offset-[6px] hover:decoration-[#14284B]">
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section aria-labelledby="latest-heading" className="mx-auto max-w-6xl px-4 pt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 id="latest-heading" style={display} className="text-xl font-semibold text-[#14284B]">Latest cars</h2>
            <Link href="/cars" className="text-sm font-semibold text-[#14284B] underline decoration-[#B8924F] decoration-2 underline-offset-4">See all cars</Link>
          </div>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((car) => <li key={car.id}><ListingCard car={car} /></li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="why-heading" style={display} className="text-xl font-semibold text-[#14284B]">Why buy on CarMart</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title} className="border-t-2 border-[#B8924F] pt-5">
              <h3 className="text-[17px] font-semibold text-[#1B2333]">{r.title}</h3>
              <p className="mt-2 max-w-[22rem] leading-relaxed text-[#5A6578]">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#DDE3EC] bg-[#EEF3F9]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 style={display} className="text-2xl font-semibold text-[#14284B]">Selling a car?</h2>
            <p className="mt-2 max-w-[34rem] leading-relaxed text-[#425066]">
              Open a free shop, list up to 10 cars, and go live as soon as your photos pass the checks.
            </p>
          </div>
          <Link href="/sell"
            className="self-start rounded-md bg-[#14284B] px-6 py-3 font-semibold text-white hover:bg-[#0E1D38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8924F] md:self-auto">
            Open a free shop
          </Link>
        </div>
      </section>

    </main>
  )
}
