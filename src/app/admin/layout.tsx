import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { listQueue, type QueueName } from '@/services/moderation.service'
import { getMe } from '@/services/profile.service'

const NAV: { href: string; label: string; queue: QueueName }[] = [
  { href: '/admin/shops', label: 'Shops', queue: 'shops' },
  { href: '/admin/images', label: 'Photos', queue: 'images' },
  { href: '/admin/duplicate-vins', label: 'Duplicate VINs', queue: 'duplicate-vins' },
  { href: '/admin/other-make-model', label: 'Other make/model', queue: 'other-make-model' },
  { href: '/admin/reports', label: 'Reports', queue: 'reports' },
]

/** The admin area 404s for everyone except active admins (the area isn't advertised). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const db = createServerSupabase()
  const me = await getMe(db)
  if (!me.ok || me.value.role !== 'admin') notFound()
  const counts = await Promise.all(NAV.map((n) => listQueue(db, n.queue, 1, { countOnly: true })))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-4 border-b border-gray-200 pb-3 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        {NAV.map((n, i) => {
          const c = counts[i]
          const total = c.ok ? c.value.page.total : 0
          return <Link key={n.href} href={n.href} className="hover:underline">{n.label}{total > 0 ? ` (${total})` : ''}</Link>
        })}
        <Link href="/admin/settings" className="hover:underline">Settings</Link>
      </nav>
      {children}
    </div>
  )
}
