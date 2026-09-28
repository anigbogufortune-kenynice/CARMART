import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { isPostcodeInState } from '@/lib/au-postcode'
import { ShopCreateSchema, type ShopCreateInput, type ShopStatus } from '@/types/domain'
import { err, ok, type AppError, type Result } from '@/types/result'

/** Owner/admin view of a shop (docs/api-contracts.md → Shop response shape). */
export type Shop = {
  id: string
  name: string
  slug: string
  description: string | null
  suburb: string
  state: string
  postcode: string
  status: ShopStatus
  status_reason: string | null
  verified: boolean
  show_phone: boolean
  listing_cap: number
  active_listing_count: number
  created_at: string
}

const OWNER_COLUMNS =
  'id,name,slug,description,suburb,state,postcode,status,status_reason,show_phone,listing_cap,created_at,owner:profiles!shops_owner_id_fkey(phone_verified_at)'

type ShopRow = Omit<Shop, 'verified' | 'active_listing_count'> & { owner: { phone_verified_at: string | null } | null }

function toShop(row: ShopRow): Shop {
  const { owner, ...rest } = row
  return { ...rest, verified: row.status === 'approved' && !!owner?.phone_verified_at, active_listing_count: 0 }
}

function mapWriteError(error: PostgrestError): AppError {
  if (error.code === '23505' && error.message.includes('shops_owner_id_key')) {
    return { code: 'SHOP_ALREADY_EXISTS', message: 'You already have a shop' }
  }
  if (error.code === '23505' && error.message.includes('shops_slug_key')) {
    return { code: 'SLUG_TAKEN', message: 'That web address is taken' }
  }
  if (error.message.includes('shops_postcode_matches_state')) {
    return { code: 'POSTCODE_STATE_MISMATCH', message: 'That postcode is not in the selected state' }
  }
  if (error.code === '42501') return { code: 'FORBIDDEN', message: 'You cannot create a shop right now' }
  return { code: 'INTERNAL_ERROR', message: error.message }
}

export async function createShop(db: SupabaseClient, input: ShopCreateInput): Promise<Result<Shop, AppError>> {
  const parsed = ShopCreateSchema.safeParse(input)
  if (!parsed.success) return err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message })
  if (!isPostcodeInState(parsed.data.postcode, parsed.data.state)) {
    return err({ code: 'POSTCODE_STATE_MISMATCH', message: 'That postcode is not in the selected state' })
  }
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return err({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' })

  const { data, error } = await db
    .from('shops')
    .insert({ ...parsed.data, owner_id: auth.user.id })
    .select(OWNER_COLUMNS)
    .single()
  if (error) return err(mapWriteError(error))
  return ok(toShop(data as unknown as ShopRow))
}

export async function getMyShop(db: SupabaseClient): Promise<Result<Shop, AppError>> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return err({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' })
  const { data, error } = await db.from('shops').select(OWNER_COLUMNS).eq('owner_id', auth.user.id).maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return err({ code: 'NOT_FOUND', message: 'You have not created a shop yet' })
  return ok(toShop(data as unknown as ShopRow))
}
