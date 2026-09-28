import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

/** Service-role client for E2E setup only (never app code; see ADR-006). */
export function e2eAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Create a confirmed user directly (fast path for journeys that don't test sign-up itself). */
export async function createConfirmedUser(email: string, password = 'long-enough-pass') {
  const { data, error } = await e2eAdmin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createConfirmedUser: ${error?.message}`)
  return { id: data.user.id, email, password }
}
