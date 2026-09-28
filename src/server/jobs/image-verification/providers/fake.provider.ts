/**
 * Deterministic fake providers for tests and local development (ADR-004, INV-I6).
 * A fixture is identified by the colour of its top-left marker block (see
 * scripts/generate-fixtures.ts), which survives resizing and re-encoding.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { err, ok, type AppError, type Result } from '@/types/result'
import type { AiCheckProvider, AiCheckResult, CarCheckProvider, CarCheckResult, CarView } from './types'

type ManifestEntry = {
  marker: [number, number, number] | null
  car: Omit<CarCheckResult, 'provider' | 'notes'> | 'error' | null
  ai: { score: number } | 'error' | null
}
type Manifest = { markerTolerance: number; fixtures: Record<string, ManifestEntry> }

const MANIFEST_PATH = join(process.cwd(), 'tests/fixtures/images/manifest.json')
let manifestCache: Manifest | null = null
const manifest = (): Manifest => (manifestCache ??= JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest)

const vendorError = (name: string): AppError => ({ code: 'VENDOR_ERROR', message: `Fake vendor error for fixture ${name}` })
const unknownFixture: AppError = {
  code: 'UNKNOWN_FIXTURE',
  message: 'Image is not a known fixture (FAKE_PROVIDER_STRICT=1). Add it to tests/fixtures/images/manifest.json.',
}

async function identify(image: Buffer): Promise<[string, ManifestEntry] | null> {
  const meta = await sharp(image).metadata()
  if (!meta.width || !meta.height) return null
  const size = Math.max(1, Math.floor(Math.min(meta.width, meta.height) * 0.08))
  // stats() ignores earlier pipeline steps, so extract the corner to its own buffer first.
  const corner = await sharp(image).extract({ left: 0, top: 0, width: size, height: size }).png().toBuffer()
  const { channels } = await sharp(corner).stats()
  const [r, g, b] = channels.map((c) => c.mean)
  const { markerTolerance, fixtures } = manifest()
  for (const entry of Object.entries(fixtures)) {
    const marker = entry[1].marker
    if (!marker) continue
    if (Math.abs(marker[0] - r) <= markerTolerance && Math.abs(marker[1] - g) <= markerTolerance && Math.abs(marker[2] - b) <= markerTolerance) {
      return entry
    }
  }
  return null
}

type Options = { strict?: boolean }
const isStrict = (o: Options) => o.strict ?? process.env.FAKE_PROVIDER_STRICT === '1'

export class FakeCarCheckProvider implements CarCheckProvider {
  constructor(private readonly options: Options = {}) {}

  async check(jpeg: Buffer): Promise<Result<CarCheckResult, AppError>> {
    const found = await identify(jpeg)
    if (!found) {
      if (isStrict(this.options)) return err(unknownFixture)
      return ok({ provider: 'fake', isCar: true, confidence: 0.99, view: 'exterior' as CarView, isScreenOrPrint: false, plateVisible: false, faceVisible: false, notes: 'unknown image (local default)' })
    }
    const [name, entry] = found
    if (entry.car === 'error' || entry.car === null) return err(vendorError(name))
    return ok({ provider: 'fake', ...entry.car, notes: `fixture ${name}` })
  }
}

export class FakeAiCheckProvider implements AiCheckProvider {
  constructor(private readonly options: Options = {}) {}

  async check(original: Buffer, _mime: string): Promise<Result<AiCheckResult, AppError>> {
    void _mime
    const found = await identify(original)
    if (!found) {
      if (isStrict(this.options)) return err(unknownFixture)
      return ok({ provider: 'fake', score: 0.01, raw: { fixture: null } })
    }
    const [name, entry] = found
    if (entry.ai === 'error' || entry.ai === null) return err(vendorError(name))
    return ok({ provider: 'fake', score: entry.ai.score, raw: { fixture: name } })
  }
}
