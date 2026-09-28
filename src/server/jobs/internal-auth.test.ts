// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { requireInternalSecret } from './internal-auth'

const SECRET = 'ci-internal-job-secret-0123456789abcdef'
const req = (auth?: string) => new Request('http://localhost/api/internal/x', { method: 'POST', headers: auth ? { authorization: auth } : {} })

describe('requireInternalSecret', () => {
  it('accepts the exact bearer secret', () => {
    expect(requireInternalSecret(req(`Bearer ${SECRET}`), SECRET)).toEqual({ ok: true, value: true })
  })
  it.each([
    ['wrong secret', `Bearer ${SECRET.replace('0', '1')}`],
    ['different length', 'Bearer short'],
    ['missing header', undefined],
    ['wrong scheme', `Basic ${SECRET}`],
  ])('rejects %s without throwing', (_label, header) => {
    expect(requireInternalSecret(req(header), SECRET)).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
  })
  it('rejects everything when the configured secret is too short', () => {
    expect(requireInternalSecret(req('Bearer abc'), 'abc')).toMatchObject({ ok: false })
  })
})
