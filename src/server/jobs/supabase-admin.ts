import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { jobsEnv } from './env'

/**
 * The ONLY service-role Supabase client in the app (ADR-006). Bypasses RLS.
 * ESLint forbids importing this file outside src/server/jobs/**.
 */
let client: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (!client) {
    const env = jobsEnv()
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
