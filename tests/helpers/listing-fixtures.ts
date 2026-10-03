import type { SupabaseClient } from '@supabase/supabase-js'
import { createDraft, listMakes, listModels } from '@/services/listing.service'
import { createShop } from '@/services/shop.service'
import { adminDb, asUser, createUser } from './supabase-test'

/** A shop owner (approved unless told otherwise) with a signed-in client. */
export async function ownerWithShop(email: string, opts: { approved?: boolean; cap?: number } = {}) {
  const db = await asUser(await createUser({ email }))
  const shop = await createShop(db, { name: 'Coastal Cars', slug: `shop-${email.split('@')[0].replace(/[^a-z0-9]/g, '')}`, city: 'Ikeja', state: 'Lagos' })
  if (!shop.ok) throw new Error(shop.error.message)
  const patch: Record<string, unknown> = {}
  if (opts.approved !== false) patch.status = 'approved'
  if (opts.cap) patch.listing_cap = opts.cap
  if (Object.keys(patch).length) await adminDb().from('shops').update(patch).eq('id', shop.value.id)
  return { db, shopId: shop.value.id }
}

let hilux: { make_id: string; model_id: string } | null = null
export async function hiluxIds() {
  if (hilux) return hilux
  const makes = await listMakes(adminDb())
  if (!makes.ok) throw new Error('makes')
  const toyota = makes.value.find((m) => m.name === 'Toyota')!
  const models = await listModels(adminDb(), toyota.id)
  if (!models.ok) throw new Error('models')
  hilux = { make_id: toyota.id, model_id: models.value.find((m) => m.name === 'HiLux')!.id }
  return hilux
}

let vinCounter = 0
/** A unique valid VIN per call. */
export function uniqueVin(): string {
  vinCounter += 1
  return `JTFST22P9${String(Date.now() % 1e5).padStart(5, '0')}${String(vinCounter).padStart(3, '0')}`.slice(0, 17)
}

/** A complete draft with `photos` photos in the given status (inserted directly: no storage needed). */
export async function completeDraft(
  db: SupabaseClient, shopId: string,
  opts: { vin?: string; photos?: number; photoStatus?: string; other?: boolean } = {},
) {
  const identity = opts.other
    ? { make_id: null, make_other: 'Holden-ish', model_id: null, model_other: 'Special' }
    : { ...(await hiluxIds()), make_other: null, model_other: null }
  const draft = await createDraft(db, {
    ...identity, year: 2019, odometer_km: 84_000, price_cents: 1_850_000_000, condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic',
    fuel: 'diesel', colour: 'White', vin: opts.vin ?? uniqueVin(), state: 'Lagos', city: 'Ikeja',
  })
  if (!draft.ok) throw new Error(draft.error.message)
  const count = opts.photos ?? 4
  if (count > 0) {
    const rows = Array.from({ length: count }, (_, i) => ({
      listing_id: draft.value.id, shop_id: shopId, position: i, quarantine_path: `${shopId}/${draft.value.id}/p${i}`,
      mime_type: 'image/jpeg', bytes: 1000, status: opts.photoStatus ?? 'passed',
    }))
    const { error } = await adminDb().from('listing_images').insert(rows)
    if (error) throw new Error(error.message)
  }
  return draft.value.id
}
