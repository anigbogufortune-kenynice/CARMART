/** Display formatting for Nigeria (ADR-015): naira and Lagos time. Prices are stored in kobo. */
export const TIME_ZONE = 'Africa/Lagos'
const LOCALE = 'en-NG'

/** ₦4,500,000 from kobo (whole naira; car prices don't need kobo). */
export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—'
  return `₦${Math.round(kobo / 100).toLocaleString(LOCALE)}`
}

/** The number a seller types back into a price field, e.g. "4,500,000". */
export function nairaInput(kobo: number | null | undefined): string {
  return kobo == null ? '' : (kobo / 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 })
}

/** Dates in Lagos time; defaults to "1 Oct 2026". */
export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(iso).toLocaleDateString('en-GB', { ...options, timeZone: TIME_ZONE })
}

/** +2348031234567 → "+234 803 123 4567" (display only; anything else is returned as is). */
export function formatNgPhone(e164: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : e164
}
