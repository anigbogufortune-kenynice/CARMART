/** Australian postcode ranges per state/territory (docs/systems/shop-onboarding.md). */
export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT'

const RANGES: Record<AuState, Array<[number, number]>> = {
  NSW: [[1000, 2599], [2619, 2899], [2921, 2999]],
  ACT: [[200, 299], [2600, 2618], [2900, 2920]],
  VIC: [[3000, 3999], [8000, 8999]],
  QLD: [[4000, 4999], [9000, 9999]],
  SA: [[5000, 5999]],
  WA: [[6000, 6999]],
  TAS: [[7000, 7999]],
  NT: [[800, 999]],
}

export function isPostcodeInState(postcode: string, state: AuState): boolean {
  if (!/^\d{4}$/.test(postcode)) return false
  const n = Number(postcode)
  return RANGES[state].some(([lo, hi]) => n >= lo && n <= hi)
}
