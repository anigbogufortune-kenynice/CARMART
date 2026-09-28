import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('CI workflow', () => {
  const wf = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
  const names: string[] = wf.jobs.ci.steps.map((s: { name?: string }) => s.name).filter(Boolean)

  it('runs on pull requests and pushes to main', () => {
    expect(wf.on.pull_request).toBeDefined()
    expect(wf.on.push.branches).toEqual(['main'])
  })

  it('runs the gates in order: lint → type-check → unit → supabase → integration → build → e2e', () => {
    // E2E runs against the production build (next start), so Build comes first.
    const order = ['Lint', 'Type-check', 'Unit tests', 'Start Supabase', 'Reset database', 'Integration tests', 'Build', 'E2E tests']
    const idx = order.map((n) => names.indexOf(n))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('never lets CI call paid vendors', () => {
    expect(wf.env).toMatchObject({ CAR_CHECK_PROVIDER: 'fake', AI_CHECK_PROVIDER: 'fake', EMAIL_PROVIDER: 'log' })
  })
})
