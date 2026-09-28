import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

describe('POST /api/internal/dispatch-notifications', () => {
  it('401 without the bearer secret, and no details leak', async () => {
    process.env.INTERNAL_JOB_SECRET = 'ci-internal-job-secret-0123456789abcdef'
    const { POST } = await import('@/app/api/internal/dispatch-notifications/route')
    const res = await POST(new NextRequest('http://localhost:3000/api/internal/dispatch-notifications', { method: 'POST' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } })
  })
})
