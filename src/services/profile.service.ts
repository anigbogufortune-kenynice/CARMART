import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
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
