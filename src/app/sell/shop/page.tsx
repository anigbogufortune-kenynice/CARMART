'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ShopForm, type ShopFormShop } from '@/components/shop/ShopForm'

export default function ShopPage() {
  const [shop, setShop] = useState<ShopFormShop | null | undefined>(undefined)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    fetch('/api/shops/me')
      .then((r) => r.json())
      .then((j: { data?: ShopFormShop }) => setShop(j.data ?? null))
      .catch(() => setShop(null))
  }, [])

  if (created) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold">Shop created (draft)</h1>
        <p className="mt-3 text-gray-700">
          Next, verify your mobile number and submit your shop for approval. You can start drafting car listings now.
        </p>
        <Link href="/sell" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white">Back to your checklist</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">{shop ? 'Edit your shop' : 'Create your shop'}</h1>
      <p className="mt-2 text-sm text-gray-600">Your shop goes public once your phone is verified and our team approves it.</p>
      {shop === undefined ? null : shop ? (
        <ShopForm mode="edit" shop={shop} onSaved={setShop} />
      ) : (
        <ShopForm mode="create" onSaved={() => setCreated(true)} />
      )}
    </main>
  )
}
