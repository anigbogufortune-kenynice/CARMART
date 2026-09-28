import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * User-scoped Supabase client for Server Components, Route Handlers and Server Actions.
 * Uses the anon key + the caller's session cookies, so RLS always applies.
 * Create a new one per request; never share across requests.
 */
export function createServerSupabase(): SupabaseClient {
  const cookieStore = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only. The middleware
          // (src/middleware.ts) refreshes the session, so this is safe to ignore here.
        }
      },
    },
  })
}
