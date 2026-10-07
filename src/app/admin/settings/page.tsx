import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSettings } from '@/services/settings.service'
import { SettingsForm } from './SettingsForm'

export const metadata: Metadata = { title: 'Settings | CarMart admin' }
export const dynamic = 'force-dynamic'

/** /admin/settings: photo-check thresholds and platform limits. Changes apply to the next photo or request. */
export default async function AdminSettingsPage() {
  const res = await getSettings(createServerSupabase())
  return (
    <main>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">Changes take effect for the next photo checked or request made. Every change is recorded in the audit log.</p>
      {res.ok ? <SettingsForm initial={res.value} /> : <p role="alert" className="mt-6 rounded bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load settings: {res.error.message}</p>}
    </main>
  )
}
