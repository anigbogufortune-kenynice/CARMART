import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SellChecklist } from '@/components/shop/SellChecklist'
import { createServerSupabase } from '@/lib/supabase/server'
import { getMe } from '@/services/profile.service'
import { getMyShop } from '@/services/shop.service'

export const metadata: Metadata = { title: 'Sell your car | CarMart' }

export default async function SellPage() {
  const db = createServerSupabase()
  const me = await getMe(db)
  if (!me.ok) redirect('/sign-in?next=/sell')
  const shop = await getMyShop(db)
  const current = shop.ok ? shop.value : null

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Sell on CarMart</h1>
      <p className="mt-2 text-gray-700">
        Every CarMart shop is verified before it goes public. Complete these steps to start selling.
      </p>
      {current?.status === 'rejected' && current.status_reason && (
        <p role="alert" className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-red-900">
          Your shop wasn&apos;t approved: {current.status_reason}
        </p>
      )}
      <SellChecklist state={{ hasShop: !!current, phoneVerified: me.value.phone_verified, shopStatus: current?.status ?? null }} />
      {current && (
        <p className="mt-6 text-sm">
          <Link href="/sell/shop" className="underline">Edit shop details</Link>
          {current.status === 'approved' && (
            <> · <Link href={`/shops/${current.slug}`} className="underline">View your public shop</Link></>
          )}
        </p>
      )}
    </main>
  )
}
