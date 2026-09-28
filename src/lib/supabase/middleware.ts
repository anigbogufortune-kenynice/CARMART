import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session on every matched request and writes any rotated
 * auth cookies (and the cache headers Supabase asks for) onto the response.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // getUser() validates the JWT with Supabase Auth and triggers a refresh when needed.
  // Do not put logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  if (user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle()
    const target = shouldRedirectSuspended(path, profile?.status ?? null)
    if (target) {
      const redirect = NextResponse.redirect(new URL(target, request.url))
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
      return redirect
    }
  }
  return response
}

const PROTECTED = ['/account', '/sell', '/admin']

/** Where a signed-in user with this profile status must be sent, or null to continue. */
export function shouldRedirectSuspended(pathname: string, status: 'active' | 'suspended' | null): string | null {
  if (status !== 'suspended') return null
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? '/suspended' : null
}
