import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/** Only same-site relative paths: "/x" but never "//host", "/\host" or absolute URLs. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

/** GET /auth/callback: exchanges an OAuth / email-confirmation code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const { error } = await createServerSupabase().auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }
  return NextResponse.redirect(new URL('/sign-in?error=link_invalid', origin))
}
