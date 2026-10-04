'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ListingCard } from '@/components/search/ListingCard'
import type { SavedCar } from '@/services/saved.service'

/** Saved cars grid; unavailable ones show a notice and a Remove button. */
export function SavedList({ initial }: { initial: SavedCar[] }) {
  const [cars, setCars] = useState(initial)

  async function remove(id: string) {
    const res = await fetch(`/api/saved-listings/${id}`, { method: 'DELETE' })
    if (res.ok) setCars((c) => c.filter((x) => x.id !== id))
  }

  if (cars.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-[#CBD3DF] bg-white px-6 py-12 text-center">
        <p className="text-lg font-semibold text-[#14284B]">No saved cars yet</p>
        <p className="mt-2 text-[#5A6578]">Tap Save on any car to keep it here.</p>
        <Link href="/cars" className="mt-5 inline-block rounded-md bg-[#14284B] px-5 py-2.5 font-semibold text-white">Browse cars</Link>
      </div>
    )
  }
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cars.map((car) => (
        <li key={car.id}>
          {car.unavailable ? (
            <div className="flex h-full flex-col justify-between rounded-xl border border-[#E2E7EF] bg-white p-4">
              <div>
                <p className="font-semibold text-[#1B2333]">{car.title}</p>
                <p className="mt-1 text-sm text-[#8A94A6]">No longer available</p>
              </div>
              <button type="button" onClick={() => void remove(car.id)}
                className="mt-4 self-start rounded-md border border-[#CBD3DF] px-3 py-1.5 text-sm font-semibold text-[#14284B]">Remove</button>
            </div>
          ) : (
            <div className="relative h-full">
              <ListingCard car={car} />
              <button type="button" onClick={() => void remove(car.id)} aria-label={`Remove ${car.title} from saved`}
                className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#14284B] shadow">Remove</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
