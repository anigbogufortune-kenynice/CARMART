import { describe, expect, it } from 'vitest'
import { isUuid } from './uuid'

describe('isUuid', () => {
  it('accepts canonical UUIDs only', () => {
    expect(isUuid('6f1c1b1e-8a3e-4b8e-9a61-1c2b3d4e5f60')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})
