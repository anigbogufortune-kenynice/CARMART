import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import { render } from './templates'

export type SentEmail = { to: string; subject: string; text: string; html: string }
export type EmailSender = { send(message: SentEmail): Promise<void> }
export type DispatchResult = { sent: number; skipped: number; failed: number; retrying: number }

const MAX_ATTEMPTS = 5

type ClaimedRow = { id: string; user_id: string; kind: string; payload: Record<string, unknown>; attempts: number }

/** Build the sender for the configured provider (EMAIL_PROVIDER=log in dev/tests). */
export function emailSender(provider: 'resend' | 'log', apiKey?: string, from?: string): EmailSender {
  if (provider === 'log') {
    return { send: async (m) => logger.info('email (log provider)', { to: m.to, subject: m.subject, text: m.text }) }
  }
  const resend = new Resend(apiKey)
  return {
    send: async (m) => {
      const { error } = await resend.emails.send({ from: from!, to: m.to, subject: m.subject, text: m.text, html: m.html })
      if (error) throw new Error(`Resend: ${error.message}`)
    },
  }
}

/**
 * Claim up to `limit` pending notifications (FOR UPDATE SKIP LOCKED in SQL, so concurrent
 * dispatchers never double-send), render and send each, then record the outcome.
 * `db` must be the service-role client.
 */
export async function dispatchPending(db: SupabaseClient, limit: number, sender: EmailSender): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0, retrying: 0 }
  const { data, error } = await db.rpc('claim_notifications', { p_limit: limit })
  if (error) throw new Error(`claim_notifications failed: ${error.message}`)

  for (const row of (data ?? []) as ClaimedRow[]) {
    const rendered = render(row.kind, row.payload ?? {})
    if (!rendered.ok) {
      logger.warn('notification skipped', { id: row.id, kind: row.kind, reason: rendered.error.message })
      await db.rpc('finish_notification', { p_id: row.id, p_status: 'skipped', p_error: rendered.error.message })
      result.skipped++
      continue
    }
    try {
      const { data: userData, error: userError } = await db.auth.admin.getUserById(row.user_id)
      const to = userData.user?.email
      if (userError || !to) throw new Error(`recipient lookup failed: ${userError?.message ?? 'no email'}`)
      await sender.send({ to, ...rendered.value })
      await db.rpc('finish_notification', { p_id: row.id, p_status: 'sent', p_error: null })
      result.sent++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const giveUp = row.attempts >= MAX_ATTEMPTS
      logger.error('notification send failed', { id: row.id, kind: row.kind, attempts: row.attempts, error: message })
      await db.rpc('finish_notification', { p_id: row.id, p_status: giveUp ? 'failed' : 'pending', p_error: message })
      if (giveUp) result.failed++
      else result.retrying++
    }
  }
  return result
}

/** Entry point for /api/internal/dispatch-notifications: env-configured sender + service-role client. */
export async function runDispatch(limit = 50): Promise<DispatchResult> {
  const [{ jobsEnv }, { adminClient }] = await Promise.all([import('../env'), import('../supabase-admin')])
  const env = jobsEnv()
  return dispatchPending(adminClient(), limit, emailSender(env.EMAIL_PROVIDER, env.RESEND_API_KEY, env.EMAIL_FROM))
}
