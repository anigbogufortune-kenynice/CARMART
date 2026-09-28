/**
 * Deterministically generates the image fixtures used by the fake providers and
 * the pipeline tests (issue 017). Run: `npm run fixtures`.
 *
 * Each "checkable" fixture carries a solid marker block in its top-left corner.
 * The fake providers identify the fixture by that marker's colour, which
 * survives resizing and JPEG re-encoding (the car check receives a re-encoded
 * 1568px copy, so byte hashes would not match).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp, { type OverlayOptions } from 'sharp'

const OUT = 'tests/fixtures/images'
const W = 1600
const H = 1200

type Expected = {
  marker: [number, number, number] | null
  car: { isCar: boolean; confidence: number; view: string; isScreenOrPrint: boolean; plateVisible: boolean; faceVisible: boolean } | 'error' | null
  ai: { score: number } | 'error' | null
  note: string
}

const car = (isCar: boolean, confidence: number, view: string, isScreenOrPrint = false) => ({
  isCar, confidence, view, isScreenOrPrint, plateVisible: false, faceVisible: false,
})

const FIXTURES: Record<string, Expected> = {
  'car-exterior.jpg': { marker: [220, 40, 40], car: car(true, 0.97, 'exterior'), ai: { score: 0.02 }, note: 'passes' },
  'car-interior.jpg': { marker: [40, 220, 40], car: car(true, 0.94, 'interior'), ai: { score: 0.03 }, note: 'passes (interior counts as a car photo)' },
  'dog.jpg': { marker: [40, 40, 220], car: car(false, 0.95, 'not_car'), ai: { score: 0.02 }, note: 'D4 rejected: not a car' },
  'ai-car.jpg': { marker: [220, 220, 40], car: car(true, 0.96, 'exterior'), ai: { score: 0.95 }, note: 'D2 rejected: AI-generated' },
  'borderline-ai.jpg': { marker: [220, 40, 220], car: car(true, 0.93, 'exterior'), ai: { score: 0.7 }, note: 'D3 in_review' },
  'screen-photo.jpg': { marker: [40, 220, 220], car: car(true, 0.9, 'exterior', true), ai: { score: 0.05 }, note: 'D7 in_review: photo of a screen' },
  'vendor-error.jpg': { marker: [255, 0, 128], car: 'error', ai: 'error', note: 'both providers fail → retries → D9 in_review' },
  'with-gps.jpg': { marker: [230, 140, 30], car: car(true, 0.95, 'exterior'), ai: { score: 0.02 }, note: 'passes; carries EXIF GPS that must be stripped' },
  'tiny.jpg': { marker: null, car: null, ai: null, note: 'D1 rejected: 640×480 is below 800×600' },
  'animated.webp': { marker: null, car: null, ai: null, note: 'D1 rejected: animated' },
  'not-an-image.jpg': { marker: null, car: null, ai: null, note: 'D1 rejected: not decodable' },
}

/** Seeded PRNG (mulberry32) so the noise background is identical on every run. */
function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function background(width: number, height: number, seed: number): Buffer {
  const rand = prng(seed)
  const buf = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const n = Math.floor(rand() * 40)
      buf[i] = 90 + ((x * 60) / width) + n // gentle gradients + noise, no large flat areas
      buf[i + 1] = 100 + ((y * 60) / height) + n
      buf[i + 2] = 110 + n
    }
  }
  return buf
}

/**
 * Large seed-driven shapes give every fixture its own structure, so their perceptual hashes
 * are far apart (noise alone averages out and every fixture would hash alike). The shapes
 * stay clear of the top-left marker block.
 */
async function shapes(seed: number, width: number, height: number) {
  const rand = prng(seed * 7919)
  const out: OverlayOptions[] = []
  for (let i = 0; i < 6; i++) {
    const w = Math.round(width * (0.15 + rand() * 0.35))
    const h = Math.round(height * (0.15 + rand() * 0.35))
    const left = Math.round(width * 0.15 + rand() * (width * 0.85 - w))
    const top = Math.round(rand() * (height - h))
    const shade = Math.round(rand() * 255)
    const input = await sharp({ create: { width: w, height: h, channels: 3, background: { r: shade, g: 255 - shade, b: Math.round(rand() * 255) } } }).png().toBuffer()
    out.push({ input, left, top })
  }
  return out
}

async function photo(seed: number, marker: [number, number, number] | null, width = W, height = H) {
  const block = Math.round(width * 0.12)
  const composite: OverlayOptions[] = await shapes(seed, width, height)
  if (marker) {
    const input = await sharp({ create: { width: block, height: block, channels: 3, background: { r: marker[0], g: marker[1], b: marker[2] } } }).png().toBuffer()
    composite.push({ input, left: 0, top: 0 })
  }
  // Flatten the composite first so later steps (withExif, animation frames) see one image.
  const flat = await sharp(background(width, height, seed), { raw: { width, height, channels: 3 } }).composite(composite).png().toBuffer()
  return sharp(flat)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  let seed = 1
  for (const [name, spec] of Object.entries(FIXTURES)) {
    seed += 1
    const path = join(OUT, name)
    if (name === 'not-an-image.jpg') {
      writeFileSync(path, 'This is plain text pretending to be a JPEG.\n')
    } else if (name === 'tiny.jpg') {
      writeFileSync(path, await (await photo(seed, null, 640, 480)).jpeg({ quality: 85 }).toBuffer())
    } else if (name === 'animated.webp') {
      const frames = await Promise.all([seed, seed + 100].map(async (s) => (await photo(s, null, 900, 700)).png().toBuffer()))
      writeFileSync(path, await sharp(frames, { join: { animated: true } }).webp({ loop: 0, delay: [200, 200] }).toBuffer())
    } else if (name === 'with-gps.jpg') {
      const img = (await photo(seed, spec.marker)).withExif({
        IFD0: { Make: 'Canon', Model: 'EOS Test' },
        IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '33/1 52/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '151/1 12/1 0/1' },
      })
      writeFileSync(path, await img.jpeg({ quality: 88 }).toBuffer())
    } else {
      writeFileSync(path, await (await photo(seed, spec.marker)).jpeg({ quality: 88 }).toBuffer())
    }
  }
  const manifest = Object.fromEntries(Object.entries(FIXTURES).map(([name, s]) => [name, s]))
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ markerTolerance: 24, fixtures: manifest }, null, 2) + '\n')
  process.stdout.write(`Generated ${Object.keys(FIXTURES).length} fixtures in ${OUT}\n`)
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`)
  process.exit(1)
})
