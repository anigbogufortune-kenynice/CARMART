import { describe, expect, it } from 'vitest'
import { isValidVin, normaliseVin } from './vin'

describe('VIN helpers (BR-L2)', () => {
  it('normalises whitespace and case', () => {
    expect(normaliseVin(' jtfst22p900123456 ')).toBe('JTFST22P900123456')
  })
  it('accepts 17 chars without I, O or Q', () => {
    expect(isValidVin('JTFST22P900123456')).toBe(true)
  })
  it('rejects the wrong length', () => {
    expect(isValidVin('JTFST22P90012345')).toBe(false)
    expect(isValidVin('JTFST22P9001234567')).toBe(false)
  })
  it('rejects I, O and Q', () => {
    expect(isValidVin('JTFST22P9001234I6')).toBe(false)
    expect(isValidVin('JTFST22P9001234O6')).toBe(false)
    expect(isValidVin('JTFST22P9001234Q6')).toBe(false)
  })
  it('does not validate a check digit', () => {
    expect(isValidVin('AAAAAAAAAAAAAAAAA')).toBe(true)
  })
})
