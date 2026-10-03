'use client'

import '@fontsource-variable/archivo/wdth.css'
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
    <header className="border-b border-[#DDE3EC] bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
        <Link href="/" aria-label="CarMart home" className="text-lg font-bold tracking-tight text-[#14284B]" style={{ fontFamily: "'Archivo Variable', var(--font-geist-sans), sans-serif", fontStretch: '125%' }}>
          CarMart
        </Link>
        <div className="flex items-center gap-4 text-sm text-[#1B2333]">
          <Link href="/cars" className="hover:underline">Browse cars</Link>
          <Link href="/sell" className="hover:underline">Sell</Link>
          {user ? (
            <>
              <span className="hidden text-gray-600 sm:inline">{user.email}</span>
              <button type="button" onClick={signOut} className="rounded-md border border-[#CBD3DF] px-3 py-1.5">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className="rounded-md bg-[#14284B] px-3 py-1.5 text-white hover:bg-[#0E1D38]">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  )
}
