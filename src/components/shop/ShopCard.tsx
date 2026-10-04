import Link from 'next/link'
import type { ShopSummary } from '@/services/search.service'
import { stateLabel } from '@/types/domain'

/** Seller box on a listing page: name, place, verified badge, link to the shop. */
export function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <div className="rounded-xl border border-[#E2E7EF] bg-white p-5">
      <p className="text-[13px] text-[#5A6578]">Sold by</p>
      <Link href={`/shops/${shop.slug}`} className="mt-1 block text-lg font-semibold text-[#14284B] hover:underline">{shop.name}</Link>
      <p className="text-sm text-[#5A6578]">{shop.city}, {stateLabel(shop.state)}</p>
      {shop.verified && (
        <p className="mt-2 inline-block rounded-full bg-[#F4EDE1] px-2.5 py-0.5 text-xs font-semibold text-[#7A5E2E]">Verified shop</p>
      )}
    </div>
  )
}
