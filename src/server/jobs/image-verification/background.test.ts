// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { drainImageChecks, handleImageCheckRequest } from './background'

const SECRET = 'ci-internal-job-secret-0123456789abcdef'
const post = (body: string, auth?: string) =>
  new Request('https://carmart.netlify.app/.netlify/functions/process-image-checks', {
    method: 'POST', body, headers: auth ? { authorization: auth } : {},
  })

describe('handleImageCheckRequest (Netlify background function)', () => {
  it('401 without the bearer secret, and nothing runs', async () => {
    const run = vi.fn()
    const res = await handleImageCheckRequest(post('{}'), SECRET, run)
    expect(res.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('422 for an invalid body', async () => {
    const run = vi.fn()
    expect((await handleImageCheckRequest(post('{"job_id":"nope"}', `Bearer ${SECRET}`), SECRET, run)).status).toBe(422)
    expect((await handleImageCheckRequest(post('{not json', `Bearer ${SECRET}`), SECRET, run)).status).toBe(422)
    expect(run).not.toHaveBeenCalled()
  })

  it('runs the queue with the secret and reports the totals', async () => {
    const run = vi.fn().mockResolvedValueOnce({ processed: 2, requeued: 0, skipped: 0 }).mockResolvedValue({ processed: 0, requeued: 0, skipped: 0 })
    const res = await handleImageCheckRequest(post('', `Bearer ${SECRET}`), SECRET, run)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { processed: 2, requeued: 0, skipped: 0 } })
  })
})

describe('drainImageChecks', () => {
  it('keeps claiming batches until the queue is empty', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ processed: 5, requeued: 0, skipped: 0 })
      .mockResolvedValueOnce({ processed: 1, requeued: 1, skipped: 0 })
      .mockResolvedValue({ processed: 0, requeued: 0, skipped: 0 })
    expect(await drainImageChecks(run)).toEqual({ processed: 6, requeued: 1, skipped: 0 })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('stops after a requeue-only batch (retries wait for the next tick) and caps the rounds', async () => {
    const retry = vi.fn().mockResolvedValue({ processed: 0, requeued: 1, skipped: 0 })
    await drainImageChecks(retry)
    expect(retry).toHaveBeenCalledTimes(1)
    const busy = vi.fn().mockResolvedValue({ processed: 5, requeued: 0, skipped: 0 })
    await drainImageChecks(busy, undefined, 4)
    expect(busy).toHaveBeenCalledTimes(4)
  })

  it('a specific job id runs once', async () => {
    const run = vi.fn().mockResolvedValue({ processed: 1, requeued: 0, skipped: 0 })
    await drainImageChecks(run, '6f1c1b1e-8a3e-4b8e-9a61-1c2b3d4e5f60')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(5, '6f1c1b1e-8a3e-4b8e-9a61-1c2b3d4e5f60')
  })
})
