// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SIGHTENGINE_URL, SightengineAiCheckProvider } from './sightengine-ai-check.provider'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => {
  vi.useRealTimers()
})

describe('SightengineAiCheckProvider', () => {
  it('POSTs media + models=genai + credentials and maps type.ai_generated to the score', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ status: 'success', type: { ai_generated: 0.97 } }))
    const provider = new SightengineAiCheckProvider('user-1', 'secret-1', fetchMock)
    const res = await provider.check(Buffer.from('original'), 'image/jpeg')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(SIGHTENGINE_URL)
    expect(SIGHTENGINE_URL).toBe('https://api.sightengine.com/1.0/check.json')
    expect(init.method).toBe('POST')
    const form = init.body as FormData
    expect(form.get('models')).toBe('genai')
    expect(form.get('api_user')).toBe('user-1')
    expect(form.get('api_secret')).toBe('secret-1')
    const media = form.get('media') as Blob
    expect(media).toBeInstanceOf(Blob)
    expect(media.type).toBe('image/jpeg')
    expect(Buffer.from(await media.arrayBuffer()).toString()).toBe('original')

    expect(res).toEqual({ ok: true, value: { provider: 'sightengine', score: 0.97, raw: { status: 'success', type: { ai_generated: 0.97 } } } })
  })

  it('status failure, HTTP errors and malformed bodies → VENDOR_ERROR', async () => {
    for (const reply of [json({ status: 'failure', error: { message: 'bad' } }), json({}, 500), json({ status: 'success', type: {} })]) {
      const provider = new SightengineAiCheckProvider('u', 's', vi.fn().mockResolvedValue(reply))
      expect(await provider.check(Buffer.from('x'), 'image/jpeg')).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR' } })
    }
  })

  it('aborts after 20 s → VENDOR_ERROR', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const pending = new SightengineAiCheckProvider('u', 's', fetchMock as unknown as typeof fetch).check(Buffer.from('x'), 'image/jpeg')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(await pending).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR', message: expect.stringContaining('timed out') } })
  })
})
