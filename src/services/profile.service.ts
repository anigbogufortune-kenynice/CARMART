import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { NgMobileSchema } from '@/types/domain'
import { err, ok, type AppError, type Result } from '@/types/result'

export type Me = {
  id: string
  display_name: string
  role: 'user' | 'admin'
  phone: string | null
  phone_verified: boolean
  has_shop: boolean
}

const DisplayName = z.string().trim().min(1, 'Enter a display name').max(60, 'Display name must be 60 characters or fewer')

async function currentUserId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.auth.getUser()
  return data.user?.id ?? null
}

/** The signed-in user's profile (RLS: own row only). */
export async function getMe(db: SupabaseClient): Promise<Result<Me, AppError>> {
  const id = await currentUserId(db)
  if (!id) return err({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' })
  const [profile, shop] = await Promise.all([
    db.from('profiles').select('id,display_name,role,phone,phone_verified_at').eq('id', id).maybeSingle(),
    db.rpc('current_user_has_shop'),
  ])
  if (profile.error) return err({ code: 'INTERNAL_ERROR', message: profile.error.message })
  if (!profile.data) return err({ code: 'NOT_FOUND', message: 'Profile not found' })
  if (shop.error) return err({ code: 'INTERNAL_ERROR', message: shop.error.message })
  const p = profile.data
  return ok({
    id: p.id, display_name: p.display_name, role: p.role, phone: p.phone,
    phone_verified: p.phone_verified_at !== null, has_shop: shop.data === true,
  })
}

export async function updateDisplayName(db: SupabaseClient, displayName: string): Promise<Result<{ display_name: string }, AppError>> {
  const parsed = DisplayName.safeParse(displayName)
  if (!parsed.success) return err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message })
  const id = await currentUserId(db)
  if (!id) return err({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' })
  const { data, error } = await db.from('profiles').update({ display_name: parsed.data }).eq('id', id).select('display_name').single()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  return ok({ display_name: data.display_name })
}

/** Send an SMS code to a Nigerian mobile (sellers only; not a sign-in method). */
export async function sendPhoneCode(db: SupabaseClient, phone: string): Promise<Result<{ sent: true }, AppError>> {
  if (!NgMobileSchema.safeParse(phone).success) {
    return err({ code: 'INVALID_NG_MOBILE', message: 'Enter a Nigerian mobile number (e.g. 0803 123 4567)' })
  }
  const inUse = await db.rpc('phone_in_use', { p_phone: phone })
  if (inUse.error) return err({ code: 'INTERNAL_ERROR', message: inUse.error.message })
  if (inUse.data === true) return err({ code: 'PHONE_IN_USE', message: 'That number is already verified on another account' })

  const allowed = await db.rpc('record_phone_code_request')
  if (allowed.error) return err({ code: 'INTERNAL_ERROR', message: allowed.error.message })
  if (allowed.data !== true) return err({ code: 'RATE_LIMITED', message: 'Too many codes requested — try again in an hour' })

  const { error } = await db.auth.updateUser({ phone })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return err({ code: 'PHONE_IN_USE', message: 'That number is already verified on another account' })
    }
    if (/security purposes|rate limit|too many/i.test(error.message)) {
      return err({ code: 'RATE_LIMITED', message: 'Please wait a moment before requesting another code' })
    }
    return err({ code: 'INTERNAL_ERROR', message: error.message })
  }
  return ok({ sent: true })
}

/** Verify the 6-digit code; a DB trigger then copies the confirmed phone into profiles. */
export async function verifyPhoneCode(db: SupabaseClient, phone: string, code: string): Promise<Result<{ phone_verified: true }, AppError>> {
  if (!NgMobileSchema.safeParse(phone).success) {
    return err({ code: 'INVALID_NG_MOBILE', message: 'Enter a Nigerian mobile number (e.g. 0803 123 4567)' })
  }
  if (!/^\d{6}$/.test(code)) return err({ code: 'INVALID_CODE', message: 'Enter the 6-digit code' })
  const { error } = await db.auth.verifyOtp({ phone, token: code, type: 'phone_change' })
  if (error) return err({ code: 'INVALID_CODE', message: 'That code isn’t right' })
  return ok({ phone_verified: true })
}
