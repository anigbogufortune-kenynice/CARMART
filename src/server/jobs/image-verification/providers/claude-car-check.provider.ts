/**
 * Car check with the Claude vision model (docs/systems/image-verification.md → Claude car check).
 * The model must answer through the `report_car_check` tool; the input is validated with Zod.
 * Malformed output is retried once, then reported as a vendor error (EC-I11).
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { err, ok, type AppError, type Result } from '@/types/result'
import type { CarCheckProvider, CarCheckResult } from './types'

export const CAR_CHECK_SYSTEM_PROMPT = [
  'You check photos uploaded to a Nigerian marketplace that sells passenger cars only.',
  'Judge only what is visible in the photo. Do not guess from context you cannot see.',
  'A real car counts in any view: exterior, interior, engine bay, dashboard, wheels or another close-up of the car.',
  'These do NOT count as a car: toys, scale models, drawings, 3D renders, video game cars, trucks, buses, motorbikes, caravans, boats, and car parts on their own (not fitted to a car).',
  'Set is_screen_or_print to true when the photo shows a screen, monitor, printout or poster displaying a car rather than the car itself.',
  'Set confidence between 0 and 1 for your is_car judgement. Keep notes under 200 characters.',
  'Always answer by calling the report_car_check tool.',
].join('\n')

const VIEWS = ['exterior', 'interior', 'engine', 'dashboard', 'wheel_detail', 'other_car_detail', 'not_car'] as const

const ReportSchema = z.object({
  is_car: z.boolean(),
  confidence: z.number().min(0).max(1),
  view: z.enum(VIEWS),
  is_screen_or_print: z.boolean(),
  plate_visible: z.boolean(),
  face_visible: z.boolean(),
  notes: z.string(),
})

const TOOL = {
  name: 'report_car_check',
  description: 'Report whether the photo shows a real car, and what is visible.',
  input_schema: {
    type: 'object' as const,
    properties: {
      is_car: { type: 'boolean', description: 'True if the photo shows a real car (any part of it).' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      view: { type: 'string', enum: [...VIEWS] },
      is_screen_or_print: { type: 'boolean' },
      plate_visible: { type: 'boolean' },
      face_visible: { type: 'boolean' },
      notes: { type: 'string', maxLength: 200 },
    },
    required: ['is_car', 'confidence', 'view', 'is_screen_or_print', 'plate_visible', 'face_visible', 'notes'],
  },
}

/** The slice of the Anthropic client this provider uses (injected so tests stub only the HTTP layer). */
export type MessagesClient = Pick<Anthropic, 'messages'>

const vendorError = (message: string): AppError => ({ code: 'VENDOR_ERROR', message: `Claude car check: ${message}` })

export class ClaudeCarCheckProvider implements CarCheckProvider {
  constructor(
    private readonly client: MessagesClient,
    private readonly model: string,
  ) {}

  static fromKey(apiKey: string, model: string): ClaudeCarCheckProvider {
    return new ClaudeCarCheckProvider(new Anthropic({ apiKey, timeout: 20_000, maxRetries: 0 }), model)
  }

  async check(jpeg: Buffer): Promise<Result<CarCheckResult, AppError>> {
    let lastProblem = 'no valid answer'
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: Awaited<ReturnType<MessagesClient['messages']['create']>>
      try {
        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 400,
          system: CAR_CHECK_SYSTEM_PROMPT,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
              { type: 'text', text: 'Check this photo.' },
            ],
          }],
        })
      } catch (e) {
        return err(vendorError(e instanceof Error ? e.message : String(e)))
      }
      const block = 'content' in response ? response.content.find((b) => b.type === 'tool_use' && b.name === TOOL.name) : undefined
      const parsed = ReportSchema.safeParse(block && 'input' in block ? block.input : undefined)
      if (parsed.success) {
        const r = parsed.data
        return ok({
          provider: 'claude', isCar: r.is_car, confidence: r.confidence, view: r.view, isScreenOrPrint: r.is_screen_or_print,
          plateVisible: r.plate_visible, faceVisible: r.face_visible, notes: r.notes.slice(0, 200),
        })
      }
      lastProblem = block ? `invalid tool input (${parsed.error.issues[0]?.message ?? 'schema'})` : 'no report_car_check tool call'
    }
    return err(vendorError(lastProblem))
  }
}
