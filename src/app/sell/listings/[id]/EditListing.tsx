'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ListingForm, type ListingFormListing } from '@/components/listing/ListingForm'

export function EditListing({ initial }: { initial: ListingFormListing }) {
  const router = useRouter()
  const [listing, setListing] = useState(initial)
  return (
    <ListingForm key={listing.version} mode="edit" listing={listing}
      onSaved={(saved) => { setListing(saved); router.refresh() }} />
  )
}
