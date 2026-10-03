import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { ShopCreateSchema, ShopUpdateSchema, type ShopCreateInput, type ShopStatus, type ShopUpdateInput } from '@/types/domain'
import { err, ok, type AppError, type Result } from '@/types/result'

/** Owner/admin view of a shop (docs/api-contracts.md → Shop response shape). */
export type Shop = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  state: string
  status: ShopStatus
  status_reason: string | null
  verified: boolean
  show_phone: boolean
  listing_cap: number
  active_listing_count: number
  created_at: string
}

const OWNER_COLUMNS =
  'id,name,slug,description,city,state,status,status_reason,show_phone,listing_cap,created_at,owner:profiles!shops_owner_id_fkey(phone_verified_at)'

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
  if (error.message.includes('SLUG_LOCKED')) {
    return { code: 'SLUG_LOCKED', message: 'The web address can’t be changed after you submit your shop' }
  }
  if (error.code === '42501') return { code: 'FORBIDDEN', message: 'You cannot change this shop right now' }
  return { code: 'INTERNAL_ERROR', message: error.message }
}

export async function createShop(db: SupabaseClient, input: ShopCreateInput): Promise<Result<Shop, AppError>> {
  const parsed = ShopCreateSchema.safeParse(input)
  if (!parsed.success) return err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message })
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

export async function updateMyShop(db: SupabaseClient, patch: ShopUpdateInput): Promise<Result<Shop, AppError>> {
  const parsed = ShopUpdateSchema.safeParse(patch)
  if (!parsed.success) return err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message })
  const current = await getMyShop(db)
  if (!current.ok) return current
  const shop = current.value
  if (shop.status === 'suspended') return err({ code: 'FORBIDDEN', message: 'This shop is suspended' })

  const next = parsed.data
  if (Object.keys(next).length === 0) return ok(shop)

  const { data, error } = await db.from('shops').update(next).eq('id', shop.id).select(OWNER_COLUMNS).single()
  if (error) return err(mapWriteError(error))
  return ok(toShop(data as unknown as ShopRow))
}

/** Public view of an approved shop (no owner-only fields). */
export type PublicShop = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  state: string
  created_at: string
  verified: boolean
}

export async function getPublicShopBySlug(db: SupabaseClient, slug: string): Promise<Result<PublicShop, AppError>> {
  const { data, error } = await db
    .from('public_shops')
    .select('id,name,slug,description,city,state,created_at,verified')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!data) return err({ code: 'NOT_FOUND', message: 'Shop not found' })
  return ok(data as PublicShop)
}

const RPC_ERRORS: Record<string, AppError> = {
  PHONE_NOT_VERIFIED: { code: 'PHONE_NOT_VERIFIED', message: 'Verify your phone before submitting your shop' },
  INVALID_STATE: { code: 'INVALID_STATE', message: 'This shop can’t be submitted right now' },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'You have not created a shop yet' },
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' },
}

/** draft | rejected → pending_approval (submit_shop RPC enforces every guard). */
export async function submitMyShop(db: SupabaseClient): Promise<Result<Shop, AppError>> {
  const { error } = await db.rpc('submit_shop')
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((code) => error.message.includes(code))
    return err(known ? RPC_ERRORS[known] : { code: 'INTERNAL_ERROR', message: error.message })
  }
  return getMyShop(db)
}
