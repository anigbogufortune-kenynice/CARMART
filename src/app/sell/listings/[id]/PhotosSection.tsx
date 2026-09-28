'use client'

import { useRouter } from 'next/navigation'
import { PhotoUploader } from '@/components/listing/PhotoUploader'

/** The uploader, refreshing the server-rendered page (banner, submit readiness) when photos change. */
export function PhotosSection({ listingId, editable }: { listingId: string; editable: boolean }) {
  const router = useRouter()
  return <PhotoUploader listingId={listingId} editable={editable} onChange={() => router.refresh()} />
}
