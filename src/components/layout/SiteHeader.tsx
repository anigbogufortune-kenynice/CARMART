'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'

export type HeaderUser = { email: string } | null

export function SiteHeader({ user }: { user: HeaderUser }) {
  const router = useRouter()

  async function signOut() {
    await createBrowserSupabase().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
        <Link href="/" aria-label="CarMart home" className="text-lg font-bold tracking-tight">
          CarMart
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/cars" className="hover:underline">Browse cars</Link>
          <Link href="/sell" className="hover:underline">Sell</Link>
          {user ? (
            <>
              <span className="hidden text-gray-600 sm:inline">{user.email}</span>
              <button type="button" onClick={signOut} className="rounded border border-gray-300 px-3 py-1">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className="rounded bg-gray-900 px-3 py-1 text-white">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  )
}
