// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Netlify configuration (ADR-014)', () => {
  const toml = readFileSync('netlify.toml', 'utf8')

  it('the configured function exists and keeps sharp as an external native module', () => {
    expect(existsSync('netlify/functions/process-image-checks.mts')).toBe(true)
    expect(toml).toContain('[functions."process-image-checks"]')
    expect(toml).toMatch(/external_node_modules = \["sharp"\]/)
  })

  it('builds with the same Node major version as CI', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
    const ciNode = /node-version: (\d+)/.exec(ci)?.[1]
    expect(toml).toContain(`NODE_VERSION = "${ciNode}"`)
  })

  it('the function is a background function behind the internal secret', () => {
    const fn = readFileSync('netlify/functions/process-image-checks.mts', 'utf8')
    expect(fn).toContain('background: true')
    expect(fn).toContain('INTERNAL_JOB_SECRET')
  })
})
