'use client'

import { useState } from 'react'
import { ListingForm, type ListingFormListing } from '@/components/listing/ListingForm'

export function EditListing({ initial }: { initial: ListingFormListing }) {
  const [listing, setListing] = useState(initial)
  return <ListingForm key={listing.version} mode="edit" listing={listing} onSaved={setListing} />
}
