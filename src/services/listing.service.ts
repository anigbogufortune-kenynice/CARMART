import type { SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Listing module: reference data now; drafts, submission and lifecycle arrive in later issues.
 * Reads go through the caller's client so RLS applies (docs/schema.md → vehicle_makes).
 */

export type NamedRef = { id: string; name: string }

/** Active car makes, alphabetical (GET /api/vehicle-makes). */
export async function listMakes(db: SupabaseClient): Promise<Result<NamedRef[], AppError>> {
  const { data, error } = await db.from('vehicle_makes').select('id,name').eq('active', true).order('name')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok(data ?? [])
}

/** Active models for an active make, alphabetical. Unknown or inactive make → NOT_FOUND. */
export async function listModels(db: SupabaseClient, makeId: string): Promise<Result<NamedRef[], AppError>> {
  const { data: make, error: makeError } = await db
    .from('vehicle_makes')
    .select('id')
    .eq('id', makeId)
    .eq('active', true)
    .maybeSingle()
  if (makeError) return err({ code: 'INTERNAL_ERROR', message: makeError.message })
  if (!make) return err({ code: 'NOT_FOUND', message: 'That make was not found' })
  const { data, error } = await db
    .from('vehicle_models')
    .select('id,name')
    .eq('make_id', makeId)
    .eq('active', true)
    .order('name')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok(data ?? [])
}
