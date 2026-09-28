import type { SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type AppError, type Result } from '@/types/result'

/** Notification kinds with email templates (docs/schema.md → notifications). */
export type NotificationKind =
  | 'shop_approved' | 'shop_rejected' | 'listing_live' | 'listing_rejected' | 'listing_in_review'
  | 'listing_removed' | 'listing_expiring' | 'new_message'

/**
 * Enqueue an email into the outbox (ADR-010). Never sends directly.
 * Requires a privileged client: most enqueues happen inside SQL RPCs; this wrapper is
 * for job-runner code (src/server/jobs/**). Returns the new id, or null when throttled.
 */
export async function enqueue(
  db: SupabaseClient,
  kind: NotificationKind,
  userId: string,
  refId: string | null,
  payload: Record<string, unknown>,
): Promise<Result<string | null, AppError>> {
  const { data, error } = await db.rpc('enqueue_notification', {
    p_user: userId,
    p_kind: kind,
    p_ref: refId,
    p_payload: payload,
  })
  if (error) return err({ code: 'INTERNAL_ERROR', message: `enqueue_notification failed: ${error.message}` })
  return ok((data as string | null) ?? null)
}
