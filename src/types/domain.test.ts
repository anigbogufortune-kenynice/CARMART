import { describe, expect, it } from 'vitest'
import { AuMobileSchema, normaliseAuMobile } from './domain'

describe('AuMobileSchema / normaliseAuMobile', () => {
  it('accepts E.164 Australian mobiles only', () => {
    expect(AuMobileSchema.safeParse('+61412345678').success).toBe(true)
    expect(AuMobileSchema.safeParse('0412345678').success).toBe(false)
    expect(AuMobileSchema.safeParse('+61212345678').success).toBe(false)
  })
  it.each([
    ['0412 345 678', '+61412345678'],
    ['04 1234 5678', '+61412345678'],
    ['+61 412 345 678', '+61412345678'],
    ['61412345678', '+61412345678'],
    ['(02) 9876 5432', null],
    ['12345', null],
  ])('normalises %j → %j', (input, expected) => {
    expect(normaliseAuMobile(input)).toBe(expected)
  })
})
