import { describe, expect, it } from 'vitest'
import { formatDate, formatNaira, nairaInput, TIME_ZONE } from './format'

describe('Nigerian formatting (ADR-015)', () => {
  it('formats kobo as whole naira with the ₦ sign', () => {
    expect(formatNaira(450_000_000)).toBe('₦4,500,000')
    expect(formatNaira(null)).toBe('—')
  })
  it('shows a plain number for editing', () => {
    expect(nairaInput(1_250_050)).toBe('12,500.5')
    expect(nairaInput(null)).toBe('')
  })
  it('uses Lagos time for dates', () => {
    expect(TIME_ZONE).toBe('Africa/Lagos')
    // 23:30 UTC on 30 Sep is already 1 Oct in Lagos (UTC+1).
    expect(formatDate('2026-09-30T23:30:00Z')).toBe('1 Oct 2026')
    expect(formatDate('2026-09-30T23:30:00Z', { month: 'long', year: 'numeric' })).toBe('October 2026')
  })
})
