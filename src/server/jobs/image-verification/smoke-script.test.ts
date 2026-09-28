// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('scripts/smoke-image-vendors.ts', () => {
  it('--dry-run lists the fixtures and makes no network call', () => {
    const out = execFileSync('npx', ['tsx', 'scripts/smoke-image-vendors.ts', '--dry-run'], {
      encoding: 'utf8',
      env: { ...process.env, HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9' },
    })
    expect(out).toContain('car-exterior.jpg, dog.jpg, ai-car.jpg')
  }, 60_000)
})
