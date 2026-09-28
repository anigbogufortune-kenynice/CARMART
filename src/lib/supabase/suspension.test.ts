import { describe, expect, it } from 'vitest'
import { shouldRedirectSuspended } from './middleware'

describe('shouldRedirectSuspended', () => {
  it.each([
    ['/sell/x', 'suspended', '/suspended'],
    ['/account/profile', 'suspended', '/suspended'],
    ['/admin', 'suspended', '/suspended'],
    ['/cars', 'suspended', null],
    ['/suspended', 'suspended', null],
    ['/sell', 'active', null],
    ['/sell', null, null],
  ])('%s + %s → %s', (path, status, expected) => {
    expect(shouldRedirectSuspended(path, status as 'active' | 'suspended' | null)).toBe(expected)
  })
})
