import { describe, expect, it } from 'vitest'
import { isPostcodeInState } from './au-postcode'

describe('isPostcodeInState', () => {
  it.each([
    ['2000', 'NSW', true], ['2150', 'NSW', true], ['2600', 'ACT', true], ['2600', 'NSW', false],
    ['2620', 'NSW', true], ['2900', 'ACT', true], ['2921', 'NSW', true], ['0200', 'ACT', true],
    ['0800', 'NT', true], ['0870', 'NT', true], ['3000', 'NSW', false], ['3000', 'VIC', true],
    ['8001', 'VIC', true], ['4000', 'QLD', true], ['9999', 'QLD', true], ['5000', 'SA', true],
    ['6000', 'WA', true], ['7000', 'TAS', true], ['7000', 'VIC', false],
  ] as const)('%s in %s → %s', (postcode, state, expected) => {
    expect(isPostcodeInState(postcode, state)).toBe(expected)
  })
  it('rejects malformed postcodes', () => {
    expect(isPostcodeInState('200', 'NSW')).toBe(false)
    expect(isPostcodeInState('20000', 'NSW')).toBe(false)
    expect(isPostcodeInState('2a00', 'NSW')).toBe(false)
  })
})
