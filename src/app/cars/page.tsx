import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Cars for sale | CarMart' }

/** Placeholder until search results (issue 027): keeps the home search and header links from 404ing. */
export default function CarsPage() {
  return (
    <main className="min-h-[60vh] bg-[#FFFFFF]">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h1 className="text-3xl font-semibold text-[#14284B]">Cars for sale</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#5A6578]">
          Search results open soon. Sellers are adding their cars now, and every listing will show here once its photos
          pass our checks.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-md border border-[#CBD3DF] bg-white px-5 py-2.5 font-semibold text-[#14284B]">Back to home</Link>
          <Link href="/sell" className="rounded-md bg-[#14284B] px-5 py-2.5 font-semibold text-white">Sell a car</Link>
        </div>
      </div>
    </main>
  )
}
