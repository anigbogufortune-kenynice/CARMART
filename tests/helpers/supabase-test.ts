/**
 * Integration-test helpers. Test-only: the service-role client here must never
 * be imported by application code (enforced by ESLint, see ADR-006).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * App tables cleared by resetDb() before users are deleted, in delete order (children first).
 * Conversations go first: deleting a buyer and a shop owner in parallel would otherwise cascade
 * into the same messages and deadlock.
 */
export const TABLES: string[] = ['conversations']

export type TestUser = { id: string; email: string; password: string }

const PASSWORD = 'test-password-123'

function requireEnv(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]
    if (value) return value
  }
  throw new Error(
    `Supabase not running or ${name} missing. Start it with \`npx supabase start\` and write .env.test ` +
      '(`npx supabase status -o env > .env.test`).',
  )
}

const url = () => requireEnv('API_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
const anonKey = () => requireEnv('ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const serviceKey = () => requireEnv('SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY')

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const

export function anonDb(): SupabaseClient {
  return createClient(url(), anonKey(), noSession)
}

export function adminDb(): SupabaseClient {
  return createClient(url(), serviceKey(), noSession)
}

export async function createUser(opts: {
  email: string
  verified?: boolean
  role?: 'user' | 'admin'
  displayName?: string
}): Promise<TestUser> {
  const { data, error } = await adminDb().auth.admin.createUser({
    email: opts.email,
    password: PASSWORD,
    email_confirm: opts.verified ?? true,
    user_metadata: opts.displayName ? { display_name: opts.displayName } : undefined,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  if (opts.role === 'admin') {
    const { error: roleError } = await adminDb()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', data.user.id)
    if (roleError) throw new Error(`promote to admin failed: ${roleError.message}`)
  }
  return { id: data.user.id, email: opts.email, password: PASSWORD }
}

/** A client signed in as `user` (anon key + that user's JWT), so RLS applies. */
export async function asUser(user: TestUser): Promise<SupabaseClient> {
  const client = anonDb()
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw new Error(`asUser sign-in failed for ${user.email}: ${error.message}`)
  return client
}

export async function resetDb(): Promise<void> {
  const admin = adminDb()
  for (const table of TABLES) {
    const { error } = await admin.from(table).delete().not('created_at', 'is', null)
    if (error) throw new Error(`resetDb: clearing ${table} failed: ${error.message}`)
  }
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`resetDb: listUsers failed: ${error.message}`)
  const doomed = data.users.filter((u) => !isSeedAccount(u.email))
  const results = await Promise.all(doomed.map((u) => admin.auth.admin.deleteUser(u.id)))
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(`resetDb: deleteUser failed: ${failed.error.message}`)
}

/** Accounts created by supabase/seed.sql (e.g. admin@carmart.local) survive resetDb for E2E use. */
export function isSeedAccount(email: string | undefined): boolean {
  return !!email && email.endsWith('@carmart.local')
}
