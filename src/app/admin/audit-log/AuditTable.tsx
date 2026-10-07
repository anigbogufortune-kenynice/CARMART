import Link from 'next/link'
import type { AuditEntry } from '@/services/moderation.service'

export function timeAgo(iso: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86_400)
  return d === 1 ? '1 day ago' : `${d} days ago`
}

/** Where a target can be looked at. */
function targetHref(e: AuditEntry): string | null {
  switch (e.target_type) {
    case 'listing': return `/cars/${e.target_id}`
    case 'shop': return `/admin/shops?q=${encodeURIComponent(e.target_label ?? '')}`
    case 'report': return '/admin/reports'
    case 'settings': return '/admin/settings'
    default: return null
  }
}

/** The audit log as a table: when, action, target, actor, reason, before/after details. */
export function AuditTable({ entries, now }: { entries: AuditEntry[]; now: Date }) {
  return (
    <div className="overflow-x-auto">
      <table className="mt-4 w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-gray-300 text-gray-600">
          <tr><th className="py-2 pr-3">When</th><th className="pr-3">Action</th><th className="pr-3">Target</th><th className="pr-3">By</th><th className="pr-3">Reason</th><th>Details</th></tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const href = targetHref(e)
            const label = e.target_label ?? `${e.target_type} ${e.target_id.slice(0, 8)}`
            return (
              <tr key={e.id} className="border-b border-gray-200 align-top">
                <td className="py-2 pr-3 whitespace-nowrap"><time dateTime={e.created_at} title={e.created_at}>{timeAgo(e.created_at, now)}</time></td>
                <td className="pr-3 font-mono">{e.action}</td>
                <td className="pr-3">{href ? <Link href={href} className="underline">{label}</Link> : label}</td>
                <td className="pr-3">{e.actor_name}</td>
                <td className="pr-3">{e.reason ?? '—'}</td>
                <td>
                  <details>
                    <summary className="cursor-pointer text-gray-700">Details</summary>
                    <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify({ target_id: e.target_id, ...e.details }, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
