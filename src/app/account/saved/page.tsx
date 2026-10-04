import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { listSaved } from '@/services/saved.service'
import { SavedList } from './SavedList'

export const metadata: Metadata = { title: 'Saved cars | CarMart' }
export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const db = createServerSupabase()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) redirect('/sign-in?next=/account/saved')
  const res = await listSaved(db, 1)
  return (
    <main className="min-h-[60vh] bg-[#F6F8FB]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#14284B]">Saved cars</h1>
        {res.ok ? <SavedList initial={res.value.items} /> : (
          <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">Couldn’t load your saved cars. Please try again.</p>
        )}
      </div>
    </main>
  )
}
