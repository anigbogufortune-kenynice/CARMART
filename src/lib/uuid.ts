const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical UUID string (route params are checked before hitting the database). */
export function isUuid(value: string | undefined): value is string {
  return !!value && UUID.test(value)
}
