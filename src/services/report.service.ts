import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Reports from signed-in users (docs/api-contracts.md → POST /api/reports). The rules (visibility,
 * one open report per target, daily limit, auto-hide at three) live in the create_report RPC.
 */

export const REPORT_REASONS = ['scam', 'not_a_car', 'ai_or_fake_photos', 'wrong_details', 'offensive', 'other'] as const
export const ReportInputSchema = z.object({
  target_type: z.enum(['listing', 'shop', 'conversation']),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(1000).optional(),
}).strict()
export type ReportInput = z.infer<typeof ReportInputSchema>

const ERRORS: Record<string, AppError> = {
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', message: 'Sign in to report' },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Your account can’t send reports right now' },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Not found' },
  ALREADY_REPORTED: { code: 'ALREADY_REPORTED', message: 'You’ve already reported this' },
  REPORT_LIMIT: { code: 'REPORT_LIMIT', message: 'You’ve sent the maximum number of reports for today. Try again tomorrow.' },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: 'Keep the note under 1,000 characters' },
}

export async function createReport(db: SupabaseClient, input: ReportInput): Promise<Result<{ id: string }, AppError>> {
  const parsed = ReportInputSchema.safeParse(input)
  if (!parsed.success) return err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid report' })
  const { data, error } = await db.rpc('create_report', {
    p_target_type: parsed.data.target_type, p_target_id: parsed.data.target_id,
    p_reason: parsed.data.reason, p_note: parsed.data.note ?? null,
  })
  if (error) return err(ERRORS[error.message] ?? { code: 'INTERNAL_ERROR', message: error.message })
  return ok({ id: data as string })
}
