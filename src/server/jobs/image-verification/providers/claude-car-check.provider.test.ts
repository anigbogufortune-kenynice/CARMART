// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { CAR_CHECK_SYSTEM_PROMPT, ClaudeCarCheckProvider, type MessagesClient } from './claude-car-check.provider'

const valid = { is_car: true, confidence: 0.93, view: 'exterior', is_screen_or_print: false, plate_visible: true, face_visible: false, notes: '' }
const toolReply = (input: unknown) => ({ content: [{ type: 'tool_use', id: 't1', name: 'report_car_check', input }] })

function client(...replies: unknown[]) {
  const create = vi.fn()
  for (const r of replies) create.mockResolvedValueOnce(r)
  return { create, client: { messages: { create } } as unknown as MessagesClient }
}

describe('ClaudeCarCheckProvider', () => {
  it('sends the JPEG as base64 with the fixed prompt and a forced report_car_check tool', async () => {
    const { create, client: c } = client(toolReply(valid))
    const provider = new ClaudeCarCheckProvider(c, 'claude-test-model')
    const res = await provider.check(Buffer.from('jpeg-bytes'))

    const params = create.mock.calls[0][0]
    expect(params.model).toBe('claude-test-model')
    expect(params.system).toBe(CAR_CHECK_SYSTEM_PROMPT)
    expect(params.tools.map((t: { name: string }) => t.name)).toEqual(['report_car_check'])
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'report_car_check' })
    const image = params.messages[0].content.find((b: { type: string }) => b.type === 'image')
    expect(image).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('jpeg-bytes').toString('base64') } })

    expect(res).toEqual({
      ok: true,
      value: { provider: 'claude', isCar: true, confidence: 0.93, view: 'exterior', isScreenOrPrint: false, plateVisible: true, faceVisible: false, notes: '' },
    })
  })

  it('the prompt covers what does and does not count as a car', () => {
    for (const word of ['visible', 'interior', 'toy', 'render', 'video game', 'truck', 'bus', 'motorbike', 'caravan', 'boat', 'parts']) {
      expect(CAR_CHECK_SYSTEM_PROMPT.toLowerCase()).toContain(word)
    }
  })

  it('retries once on invalid output, then succeeds (EC-I11)', async () => {
    const { create, client: c } = client(toolReply({ ...valid, confidence: 1.7 }), toolReply(valid))
    const res = await new ClaudeCarCheckProvider(c, 'm').check(Buffer.from('x'))
    expect(create).toHaveBeenCalledTimes(2)
    expect(res.ok).toBe(true)
  })

  it('two invalid outputs → VENDOR_ERROR', async () => {
    const { create, client: c } = client(toolReply({ ...valid, confidence: 1.7 }), { content: [{ type: 'text', text: 'I think it is a car' }] })
    expect(await new ClaudeCarCheckProvider(c, 'm').check(Buffer.from('x'))).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR' } })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('an API failure → VENDOR_ERROR without a retry loop', async () => {
    const create = vi.fn().mockRejectedValue(new Error('529 overloaded'))
    const res = await new ClaudeCarCheckProvider({ messages: { create } } as unknown as MessagesClient, 'm').check(Buffer.from('x'))
    expect(res).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR' } })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('truncates notes to 200 characters', async () => {
    const { client: c } = client(toolReply({ ...valid, notes: 'n'.repeat(500) }))
    const res = await new ClaudeCarCheckProvider(c, 'm').check(Buffer.from('x'))
    expect(res.ok && res.value.notes.length).toBe(200)
  })
})
