import { describe, expect, it } from 'vitest'
import { ListingDraftSchema, ListingInputSchema } from './domain'

const valid = {
  make_id: '6f1c1b1e-8a3e-4b8e-9a61-1c2b3d4e5f60',
  make_other: null,
  model_id: '7f1c1b1e-8a3e-4b8e-9a61-1c2b3d4e5f60',
  model_other: null,
  year: 2019,
  odometer_km: 84_000,
  price_cents: 1_850_000_000,
  condition: 'foreign_used',
  body_type: 'pickup',
  transmission: 'automatic',
  fuel: 'diesel',
  colour: 'White',
  vin: 'jtfst22p900123456',
  rego: 'lnd-123-aa',
  rego_expiry: '2027-03-01',
  description: 'One owner, full service history.',
  state: 'Lagos',
  city: 'Ikeja',
}

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message)

describe('ListingInputSchema', () => {
  it('parses a complete listing and normalises VIN and rego', () => {
    const r = ListingInputSchema.safeParse(valid)
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ vin: 'JTFST22P900123456', rego: 'LND123AA' })
  })

  it('MAKE_REQUIRED when both or neither of make_id/make_other are set', () => {
    expect(messages(ListingInputSchema.safeParse({ ...valid, make_other: 'X Motors' }))).toContain('MAKE_REQUIRED')
    expect(messages(ListingInputSchema.safeParse({ ...valid, make_id: null }))).toContain('MAKE_REQUIRED')
  })

  it('MODEL_REQUIRED when both model fields are set', () => {
    expect(messages(ListingInputSchema.safeParse({ ...valid, model_other: 'Special' }))).toContain('MODEL_REQUIRED')
  })

  it('rejects year current+2, price under A$1 and non-car body types', () => {
    const y = new Date().getFullYear()
    expect(ListingInputSchema.safeParse({ ...valid, year: y + 2 }).success).toBe(false)
    expect(ListingInputSchema.safeParse({ ...valid, year: y + 1 }).success).toBe(true)
    expect(ListingInputSchema.safeParse({ ...valid, price_cents: 50_000 }).success).toBe(false)
    expect(ListingInputSchema.safeParse({ ...valid, condition: 'used' }).success).toBe(false)
    expect(ListingInputSchema.safeParse({ ...valid, condition: undefined }).success).toBe(false)
    expect(ListingInputSchema.safeParse({ ...valid, state: 'NSW' }).success).toBe(false)
    expect(ListingInputSchema.safeParse({ ...valid, body_type: 'truck' }).success).toBe(false)
  })

  it('INVALID_VIN for a bad VIN', () => {
    expect(messages(ListingInputSchema.safeParse({ ...valid, vin: 'BAD' }))).toEqual(['INVALID_VIN'])
  })

})

describe('ListingDraftSchema (partial)', () => {
  it('accepts an empty or partial draft', () => {
    expect(ListingDraftSchema.safeParse({}).success).toBe(true)
    expect(ListingDraftSchema.safeParse({ vin: 'jtfst22p900123456' }).data).toEqual({ vin: 'JTFST22P900123456' })
  })
  it('still validates every present field', () => {
    expect(messages(ListingDraftSchema.safeParse({ vin: 'BAD' }))).toEqual(['INVALID_VIN'])
    expect(ListingDraftSchema.safeParse({ body_type: 'truck' }).success).toBe(false)
    expect(messages(ListingDraftSchema.safeParse({ make_id: valid.make_id, make_other: 'X' }))).toContain('MAKE_REQUIRED')
    expect(ListingDraftSchema.safeParse({ postcode: '2150' }).success).toBe(false)
  })
  it('rejects unknown keys such as status', () => {
    expect(ListingDraftSchema.safeParse({ status: 'live' }).success).toBe(false)
  })
})
