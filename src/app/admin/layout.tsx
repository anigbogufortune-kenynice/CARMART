import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getMe } from '@/services/profile.service'

/** The admin area 404s for everyone except active admins (the area isn't advertised). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe(createServerSupabase())
  if (!me.ok || me.value.role !== 'admin') notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-4 border-b border-gray-200 pb-3 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/shops" className="hover:underline">Shops</Link>
      </nav>
      {children}
    </div>
  )
}
