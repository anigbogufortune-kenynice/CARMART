import type { Metadata } from 'next'
import { Pagination } from '@/components/search/Pagination'
import { createServerSupabase } from '@/lib/supabase/server'
import { listAuditLog } from '@/services/moderation.service'
import { AuditTable } from './AuditTable'

export const metadata: Metadata = { title: 'Audit log | CarMart admin' }
export const dynamic = 'force-dynamic'

const TYPES = ['shop', 'listing', 'image', 'user', 'report', 'settings']

type Props = { searchParams: { page?: string; target_type?: string; target_id?: string } }

/** /admin/audit-log: every admin action, newest first. Rows can't be edited or deleted. */
export default async function AuditLogPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const targetType = TYPES.includes(searchParams.target_type ?? '') ? searchParams.target_type : undefined
  const targetId = searchParams.target_id?.trim().slice(0, 100) || undefined
  const res = await listAuditLog(createServerSupabase(), { page, target_type: targetType, target_id: targetId })
  const params: Record<string, string> = { ...(targetType ? { target_type: targetType } : {}), ...(targetId ? { target_id: targetId } : {}) }
  return (
    <main>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-gray-600">Every admin decision, newest first. Entries can’t be changed or deleted.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" action="/admin/audit-log">
        <div>
          <label htmlFor="target_type" className="block text-sm font-medium">Target type</label>
          <select id="target_type" name="target_type" defaultValue={targetType ?? ''} className="mt-1 rounded border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="target_id" className="block text-sm font-medium">Target id</label>
          <input id="target_id" name="target_id" defaultValue={targetId ?? ''} className="mt-1 w-80 max-w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm" />
        </div>
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">Filter</button>
      </form>
      {!res.ok && <p role="alert" className="mt-6 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load the log: {res.error.message}</p>}
      {res.ok && res.value.items.length === 0 && <p className="mt-6 text-gray-600">No entries.</p>}
      {res.ok && res.value.items.length > 0 && <AuditTable entries={res.value.items} now={new Date()} />}
      {res.ok && <Pagination page={page} size={res.value.page.size} total={res.value.page.total} params={params} basePath="/admin/audit-log" />}
    </main>
  )
}
