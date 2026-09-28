import { describe, expect, it } from 'vitest'
import { err, ok } from './result'

describe('Result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
  })

  it('err wraps an AppError', () => {
    expect(err({ code: 'NOT_FOUND', message: 'Missing' })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Missing' },
    })
  })
})
