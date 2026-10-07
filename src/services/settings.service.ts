import type { SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Platform settings (docs/schema.md → app_settings; ADR-009). Admins read and change them here;
 * the image pipeline and the SQL rules read them at the start of each job or call, so a change
 * applies to the next photo or request.
 */

type Kind = 'fraction' | 'integer'
type DefinitionShape = { key: string; label: string; help: string; kind: Kind; min: number; max: number; group: 'Photo checks' | 'Listings' | 'Limits' }

export const SETTING_DEFINITIONS = [
  { key: 'ai_reject_threshold', label: 'AI photo: reject at', help: 'Photos scoring at or above this are rejected as AI-made.', kind: 'fraction', min: 0, max: 1, group: 'Photo checks' },
  { key: 'ai_review_threshold', label: 'AI photo: review at', help: 'Photos scoring at or above this (and below the reject level) go to the review queue.', kind: 'fraction', min: 0, max: 1, group: 'Photo checks' },
  { key: 'car_reject_confidence', label: 'Not a car: reject at', help: 'When the check says “not a car” with at least this confidence, the photo is rejected; with less, it goes to review.', kind: 'fraction', min: 0, max: 1, group: 'Photo checks' },
  { key: 'car_pass_confidence', label: 'Car: pass at', help: 'A car photo needs at least this confidence to pass on its own; below it goes to review.', kind: 'fraction', min: 0, max: 1, group: 'Photo checks' },
  { key: 'phash_max_distance', label: 'Reused photo distance', help: 'Photos this close (0 = identical) to another shop’s photo go to review.', kind: 'integer', min: 0, max: 20, group: 'Photo checks' },
  { key: 'listing_expiry_days', label: 'Listing lasts (days)', help: 'How long a listing stays live before it expires.', kind: 'integer', min: 1, max: 365, group: 'Listings' },
  { key: 'expiry_reminder_days', label: 'Expiry reminder (days before)', help: 'When sellers get the “your listing expires soon” email.', kind: 'integer', min: 1, max: 60, group: 'Listings' },
  { key: 'sold_visible_days', label: 'Sold cars stay visible (days)', help: 'How long a sold car stays on the site with a SOLD banner.', kind: 'integer', min: 1, max: 90, group: 'Listings' },
  { key: 'min_photos', label: 'Minimum photos', help: 'Photos a listing needs before it can be submitted and stay live.', kind: 'integer', min: 1, max: 20, group: 'Listings' },
  { key: 'max_photos', label: 'Maximum photos', help: 'The most photos one listing can have (20 at most).', kind: 'integer', min: 1, max: 20, group: 'Listings' },
  { key: 'reports_auto_hide_count', label: 'Auto-hide after reports', help: 'Reports from different people that hide a live car until an admin looks.', kind: 'integer', min: 1, max: 100, group: 'Limits' },
  { key: 'daily_upload_limit', label: 'Photo uploads per shop per day', help: 'Rolling 24 hours.', kind: 'integer', min: 1, max: 10000, group: 'Limits' },
  { key: 'daily_conversation_limit', label: 'New conversations per buyer per day', help: 'Rolling 24 hours.', kind: 'integer', min: 1, max: 1000, group: 'Limits' },
  { key: 'daily_report_limit', label: 'Reports per user per day', help: 'Rolling 24 hours.', kind: 'integer', min: 1, max: 1000, group: 'Limits' },
] as const satisfies readonly DefinitionShape[]

export type SettingDefinition = (typeof SETTING_DEFINITIONS)[number]
export type SettingKey = SettingDefinition['key']
export type Settings = Record<SettingKey, number>

const DEFINITION = new Map<string, SettingDefinition>(SETTING_DEFINITIONS.map((d) => [d.key, d]))
const invalid = (message: string): Result<never, AppError> => err({ code: 'VALIDATION_ERROR', message })

/** Every setting as a number (admins only). */
export async function getSettings(db: SupabaseClient): Promise<Result<Settings, AppError>> {
  const { data, error } = await db.from('app_settings').select('key,value')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data || data.length === 0) return err({ code: 'FORBIDDEN', message: 'Admins only' })
  const values = Object.fromEntries((data as { key: string; value: unknown }[]).map((r) => [r.key, Number(r.value)]))
  return ok(Object.fromEntries(SETTING_DEFINITIONS.map((d) => [d.key, values[d.key]])) as Settings)
}

/** The rules between keys, checked against the other current values. */
function relationError(key: SettingKey, value: number, s: Settings): string | null {
  if (key === 'ai_review_threshold' && !(value < s.ai_reject_threshold)) return `ai_review_threshold must be below ai_reject_threshold (${s.ai_reject_threshold})`
  if (key === 'ai_reject_threshold' && !(value > s.ai_review_threshold)) return `ai_reject_threshold must be above ai_review_threshold (${s.ai_review_threshold})`
  if (key === 'min_photos' && value > s.max_photos) return `min_photos must not be more than max_photos (${s.max_photos})`
  if (key === 'max_photos' && value < s.min_photos) return `max_photos must not be less than min_photos (${s.min_photos})`
  return null
}

/** Change one setting after validating its range and its relations to other settings; audited in SQL. */
export async function updateSetting(db: SupabaseClient, key: string, value: number): Promise<Result<{ key: SettingKey; value: number }, AppError>> {
  const def = DEFINITION.get(key)
  if (!def) return invalid(`Unknown setting: ${key}`)
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid(`${key} must be a number`)
  if (def.kind === 'integer' && !Number.isInteger(value)) return invalid(`${key} must be a whole number`)
  const inRange = def.kind === 'fraction' ? value > def.min && value <= def.max : value >= def.min && value <= def.max
  if (!inRange) return invalid(def.kind === 'fraction' ? `${key} must be above 0 and at most 1` : `${key} must be between ${def.min} and ${def.max}`)

  const current = await getSettings(db)
  if (!current.ok) return current
  const relation = relationError(def.key, value, current.value)
  if (relation) return invalid(relation)

  const { error } = await db.rpc('admin_update_setting', { p_key: key, p_value: value })
  if (error) {
    if (error.message === 'FORBIDDEN') return err({ code: 'FORBIDDEN', message: 'Admins only' })
    return err({ code: 'INTERNAL_ERROR', message: error.message })
  }
  return ok({ key: def.key, value })
}
