import type { SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Admin moderation (docs/api-contracts.md → Admin). Public API is capped at 8 exports:
 * listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension,
 * setListingCap, listAuditLog (added by their issues).
 */

export type QueueName = 'shops' | 'images' | 'duplicate-vins' | 'other-make-model' | 'reports'
export type Page<T> = { items: T[]; page: { number: number; size: number; total: number } }

export type ShopQueueItem = {
  id: string
  name: string
  slug: string
  suburb: string
  state: string
  submitted_at: string
  owner_name: string
  phone_verified: boolean
}

const PAGE_SIZE = 24

async function requireAdmin(db: SupabaseClient): Promise<AppError | null> {
  const { data, error } = await db.rpc('is_admin')
  if (error) return { code: 'INTERNAL_ERROR', message: error.message }
  return data === true ? null : { code: 'FORBIDDEN', message: 'Admins only' }
}

async function shopsQueue(db: SupabaseClient, page: number): Promise<Result<Page<ShopQueueItem>, AppError>> {
  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await db
    .from('shops')
    .select('id,name,slug,suburb,state,submitted_at,owner:profiles!shops_owner_id_fkey(display_name,phone_verified_at)', { count: 'exact' })
    .eq('status', 'pending_approval')
    .order('submitted_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  type Row = Omit<ShopQueueItem, 'owner_name' | 'phone_verified'> & { owner: { display_name: string; phone_verified_at: string | null } | null }
  const items = ((data ?? []) as unknown as Row[]).map(({ owner, ...rest }) => ({
    ...rest,
    owner_name: owner?.display_name ?? '',
    phone_verified: !!owner?.phone_verified_at,
  }))
  return ok({ items, page: { number: page, size: PAGE_SIZE, total: count ?? 0 } })
}

/** An admin review queue, oldest first. Queues other than 'shops' arrive with later issues. */
export async function listQueue(db: SupabaseClient, queue: QueueName, page = 1): Promise<Result<Page<unknown>, AppError>> {
  const denied = await requireAdmin(db)
  if (denied) return err(denied)
  const p = Math.max(1, Math.floor(page))
  switch (queue) {
    case 'shops':
      return shopsQueue(db, p)
    default:
      return err({ code: 'NOT_FOUND', message: `Unknown queue: ${queue}` })
  }
}
