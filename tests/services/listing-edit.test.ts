import { afterEach, describe, expect, it } from 'vitest'
import { updateListing } from '@/services/listing.service'
import { submitListing } from '@/services/listing-lifecycle.service'
import { getListingForViewer } from '@/services/search.service'
import { deletePhoto } from '@/services/image-upload.service'
import { adminDb, anonDb, resetDb } from '../helpers/supabase-test'
import { completeDraft, ownerWithShop } from '../helpers/listing-fixtures'

afterEach(async () => {
  await resetDb()
})

const PATHS = { sm: 'p/sm.webp', md: 'p/md.webp', lg: 'p/lg.webp' }
const row = async (id: string) =>
  (await adminDb().from('listings').select('status,version,expires_at,price_cents,year,review_flags').eq('id', id).single()).data!

async function live(email = 'a@x.ng', vin?: string) {
  const { db, shopId } = await ownerWithShop(email)
  const id = await completeDraft(db, shopId, { vin })
  await adminDb().from('listing_images').update({ public_paths: PATHS }).eq('listing_id', id)
  const r = await submitListing(db, id, 1)
  if (!r.ok || r.value.status !== 'live') throw new Error('not live')
  return { db, shopId, id, version: r.value.version }
}

describe('updateListing on a live listing', () => {
  it('minor edit (price) keeps it live, bumps version and shows publicly at once', async () => {
    const { db, id, version } = await live()
    const res = await updateListing(db, id, { price_cents: 4_299_000_00, version })
    expect(res).toMatchObject({ ok: true, value: { status: 'live', version: version + 1 } })
    const pub = await getListingForViewer(anonDb(), id)
    expect(pub.ok && pub.value.price_cents).toBe(4_299_000_00)
  })

  it('identity edit (year) → checking and hidden; evaluate brings it back live with the same expiry', async () => {
    const { db, id, version } = await live()
    const before = await row(id)
    const res = await updateListing(db, id, { year: 2020, version })
    expect(res).toMatchObject({ ok: true })
    // Photos are all passed, so evaluate runs straight away and it is live again.
    const after = await row(id)
    expect(after).toMatchObject({ status: 'live', year: 2020, expires_at: before.expires_at })
    expect(after.version).toBeGreaterThan(version)
  })

  it('identity edit while a photo is checking → checking and not public', async () => {
    const { db, id, version } = await live()
    const one = (await adminDb().from('listing_images').select('id').eq('listing_id', id).limit(1)).data![0]
    await adminDb().from('listing_images').update({ status: 'checking' }).eq('id', one.id)
    const res = await updateListing(db, id, { year: 2020, version })
    expect(res).toMatchObject({ ok: true, value: { status: 'checking' } })
    expect(await getListingForViewer(anonDb(), id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('EC-L4: changing the VIN to one live elsewhere → in_review with duplicate_vin', async () => {
    const other = await live('b@x.ng')
    const otherVin = (await adminDb().from('listings').select('vin').eq('id', other.id).single()).data!.vin as string
    const { db, id, version } = await live('a@x.ng')
    await updateListing(db, id, { vin: otherVin, version })
    expect(await row(id)).toMatchObject({ status: 'in_review', review_flags: ['duplicate_vin'] })
  })

  it('checking → INVALID_STATE; stale version → VERSION_CONFLICT', async () => {
    const { db, id, version } = await live()
    expect(await updateListing(db, id, { price_cents: 5_000_000_00, version: version - 1 }))
      .toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } })
    await adminDb().from('listings').update({ status: 'checking' }).eq('id', id)
    expect(await updateListing(db, id, { price_cents: 5_000_000_00, version }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } })
  })

  it('owners cannot bypass the rules by writing identity fields directly on a live listing', async () => {
    const { db, id } = await live()
    const { error } = await db.from('listings').update({ year: 2001 }).eq('id', id)
    expect(error).not.toBeNull()
    expect((await row(id)).year).toBe(2019)
  })
})

describe('photos on a live listing', () => {
  it('a new photo stays hidden until it passes; the listing stays live', async () => {
    const { shopId, id } = await live()
    await adminDb().from('listing_images').insert({
      listing_id: id, shop_id: shopId, position: 4, quarantine_path: `${shopId}/${id}/new`, mime_type: 'image/jpeg', bytes: 1000, status: 'checking',
    })
    const pub = await getListingForViewer(anonDb(), id)
    expect(pub.ok && pub.value.photos).toHaveLength(4)
    expect((await row(id)).status).toBe('live')
  })

  it('deleting a passed photo when exactly 4 remain → PHOTO_COUNT', async () => {
    const { db, id } = await live()
    const one = (await adminDb().from('listing_images').select('id').eq('listing_id', id).limit(1)).data![0]
    expect(await deletePhoto(db, id, one.id)).toMatchObject({ ok: false, error: { code: 'PHOTO_COUNT' } })
  })
})
