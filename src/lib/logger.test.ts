import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger'

describe('logger', () => {
  it('writes one JSON line with level, msg, time and fields', () => {
    const write = vi.fn()
    createLogger({ level: 'info', write }).info('hi', { a: 1 })
    expect(write).toHaveBeenCalledTimes(1)
    const line = JSON.parse(write.mock.calls[0][0] as string)
    expect(line).toMatchObject({ level: 'info', msg: 'hi', a: 1 })
    expect(new Date(line.time).toISOString()).toBe(line.time)
  })
  it('drops messages below the configured level', () => {
    const write = vi.fn()
    createLogger({ level: 'warn', write }).info('quiet')
    expect(write).not.toHaveBeenCalled()
  })
})
