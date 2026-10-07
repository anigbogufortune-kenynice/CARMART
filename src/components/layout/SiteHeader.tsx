'use client'

import '@fontsource-variable/archivo/wdth.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { UnreadCount } from '@/services/messaging.service'

export type HeaderUser = { email: string } | null

const NO_UNREAD: UnreadCount = { total: 0, buyer: 0, seller: 0 }

export function SiteHeader({ user, unread = NO_UNREAD }: { user: HeaderUser; unread?: UnreadCount }) {
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
              <Link href="/account/saved" className="hover:underline">Saved</Link>
              <Link href={unread.seller > 0 ? '/sell/messages' : '/account/messages'} className="inline-flex items-center gap-1.5 hover:underline">
                Messages
                {unread.total > 0 && (
                  <span aria-label={`${unread.total} unread messages`}
                    className="min-w-[1.25rem] rounded-full bg-[#B8924F] px-1.5 text-center text-xs font-semibold leading-5 text-white">
                    {unread.total > 99 ? '99+' : unread.total}
                  </span>
                )}
              </Link>
              <span className="hidden text-gray-600 md:inline">{user.email}</span>
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
