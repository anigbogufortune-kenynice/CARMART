'use client'

import { useRouter } from 'next/navigation'
import { ListingForm } from '@/components/listing/ListingForm'

export function NewListing() {
  const router = useRouter()
  return <ListingForm mode="create" onSaved={(l) => router.push(`/sell/listings/${l.id}`)} />
}
