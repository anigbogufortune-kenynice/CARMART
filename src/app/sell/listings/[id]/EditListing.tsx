'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ListingForm, type ListingFormListing } from '@/components/listing/ListingForm'

export function EditListing({ initial, live = false }: { initial: ListingFormListing; live?: boolean }) {
  const router = useRouter()
  const [listing, setListing] = useState(initial)
  return (
    <ListingForm key={listing.version} mode="edit" listing={listing} live={live}
      onSaved={(saved) => { setListing(saved); router.refresh() }} />
  )
}
