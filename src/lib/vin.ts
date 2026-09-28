/** VIN rules (BR-L2): 17 characters, uppercase A–Z and 0–9 without I, O or Q. No check digit. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/

export function normaliseVin(input: string): string {
  return input.trim().toUpperCase()
}

export function isValidVin(vin: string): boolean {
  return VIN_PATTERN.test(vin)
}
