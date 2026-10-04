import { describe, expect, it } from 'vitest'
import { NG_STATES, NgMobileSchema, normaliseNgMobile, stateLabel } from './domain'

describe('NgMobileSchema / normaliseNgMobile', () => {
  it('accepts E.164 Nigerian mobiles only', () => {
    expect(NgMobileSchema.safeParse('+2348031234567').success).toBe(true)
    expect(NgMobileSchema.safeParse('+2347011234567').success).toBe(true)
    expect(NgMobileSchema.safeParse('08031234567').success).toBe(false)
    expect(NgMobileSchema.safeParse('+2341234567890').success).toBe(false)
    expect(NgMobileSchema.safeParse('+61412345678').success).toBe(false)
  })
  it.each([
    ['0803 123 4567', '+2348031234567'],
    ['0906-123-4567', '+2349061234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['8031234567', '+2348031234567'],
    ['01 234 5678', null],
    ['0412 345 678', null],
    ['12345', null],
  ])('normalises %j → %j', (input, expected) => {
    expect(normaliseNgMobile(input)).toBe(expected)
  })
})

describe('Nigerian states', () => {
  it('has the 36 states plus the FCT, labelled for display', () => {
    expect(NG_STATES).toHaveLength(37)
    expect(NG_STATES).toContain('Lagos')
    expect(stateLabel('FCT')).toBe('FCT (Abuja)')
    expect(stateLabel('Kano')).toBe('Kano')
  })
})

describe('SearchQuerySchema', () => {
  it('coerces numbers, drops empty values, and rejects unknown keys or bad values', async () => {
    const { SearchQuerySchema } = await import('./domain')
    expect(SearchQuerySchema.parse({ price_min: '1000000', sort: 'price_asc', page: '2', make_id: '' }))
      .toEqual({ price_min: 1_000_000, sort: 'price_asc', page: 2 })
    expect(SearchQuerySchema.parse({})).toEqual({ sort: 'newest', page: 1 })
    expect(SearchQuerySchema.safeParse({ sort: 'cheapest' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ body_type: 'truck' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ foo: '1' }).success).toBe(false)
  })
})
