import type { ImageStatus } from '@/types/domain'

const LOOK: Record<ImageStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploading', className: 'bg-gray-100 text-gray-800' },
  checking: { label: 'Checking', className: 'bg-gray-100 text-gray-800' },
  passed: { label: 'Passed', className: 'bg-green-100 text-green-900' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-900' },
  in_review: { label: 'Under review', className: 'bg-amber-100 text-amber-900' },
}

/** A photo's check status, with the seller-facing reason when rejected or under review. */
export function PhotoStatusChip({ status, reason }: { status: ImageStatus; reason: string | null }) {
  const look = LOOK[status]
  return (
    <div className="space-y-1">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${look.className}`}>{look.label}</span>
      {reason && (status === 'rejected' || status === 'in_review') && <p className="text-xs text-gray-700">{reason}</p>}
    </div>
  )
}
