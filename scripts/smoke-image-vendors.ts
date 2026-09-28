/**
 * Manual pre-launch check of the REAL image vendors (docs/systems/image-verification.md).
 * Never runs in CI. Needs ANTHROPIC_API_KEY, SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in
 * .env.local. Usage: `npx tsx scripts/smoke-image-vendors.ts` (or `--dry-run` to list the fixtures).
 */
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { normalise } from '../src/server/jobs/image-verification/process-image'
import { ClaudeCarCheckProvider } from '../src/server/jobs/image-verification/providers/claude-car-check.provider'
import { SightengineAiCheckProvider } from '../src/server/jobs/image-verification/providers/sightengine-ai-check.provider'

const FIXTURES = ['car-exterior.jpg', 'dog.jpg', 'ai-car.jpg']

async function main() {
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`Would check: ${FIXTURES.join(', ')}\n`)
    return
  }
  config({ path: '.env.local', quiet: true })
  const { ANTHROPIC_API_KEY, ANTHROPIC_CAR_CHECK_MODEL, SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET } = process.env
  if (!ANTHROPIC_API_KEY || !SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
    throw new Error('Set ANTHROPIC_API_KEY, SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in .env.local')
  }
  const car = ClaudeCarCheckProvider.fromKey(ANTHROPIC_API_KEY, ANTHROPIC_CAR_CHECK_MODEL ?? 'claude-haiku-4-5-20251001')
  const ai = new SightengineAiCheckProvider(SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET)
  for (const name of FIXTURES) {
    const original = readFileSync(`tests/fixtures/images/${name}`)
    const [carResult, aiResult] = await Promise.all([car.check(await normalise(original)), ai.check(original, 'image/jpeg')])
    process.stdout.write(`${name}\n  car: ${JSON.stringify(carResult)}\n  ai:  ${JSON.stringify(aiResult.ok ? { score: aiResult.value.score } : aiResult)}\n`)
  }
  process.stdout.write('Note: the fixtures are synthetic; use real car/dog/AI photos for threshold calibration.\n')
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
