import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except static assets, images, favicon and the internal job routes
    // (those are called by Postgres with a bearer secret and carry no user session).
    '/((?!_next/static|_next/image|favicon.ico|api/internal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
