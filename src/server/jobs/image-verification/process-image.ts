/**
 * Image processing for the verification job (docs/systems/image-verification.md, steps 5–9).
 * Real `sharp` work only; the tests use the real fixture files (no mocking).
 */
import exifr from 'exifr'
import sharp, { type Metadata } from 'sharp'

export const VALIDATION_REASONS = {
  unreadable: "We couldn't read this file as a photo.",
  tooSmall: 'Photo is too small (minimum 800×600).',
  animated: "Animated images aren't allowed.",
} as const

const MIME_FORMAT: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }

export type Validation = { ok: true; width: number; height: number } | { ok: false; reason: string }

/** Step 5: decodable, format matches the declared type, still, and at least 800×600 either way round. */
export async function validate(original: Buffer, mime: string): Promise<Validation> {
  let meta: Metadata
  try {
    meta = await sharp(original, { pages: -1 }).metadata()
  } catch {
    return { ok: false, reason: VALIDATION_REASONS.unreadable }
  }
  if (!meta.format || MIME_FORMAT[mime] !== meta.format || !meta.width || !meta.height) {
    return { ok: false, reason: VALIDATION_REASONS.unreadable }
  }
  if ((meta.pages ?? 1) > 1) return { ok: false, reason: VALIDATION_REASONS.animated }
  const height = meta.pageHeight ?? meta.height
  const [long, short] = meta.width >= height ? [meta.width, height] : [height, meta.width]
  if (long < 800 || short < 600) return { ok: false, reason: VALIDATION_REASONS.tooSmall }
  return { ok: true, width: meta.width, height }
}

/** Step 6: auto-rotate, flatten onto white, long edge ≤ 1568 px, JPEG q85 (`analysis.jpg`). */
export async function normalise(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
}

/** 2-D DCT-II of an N×N matrix (N = 32 here, so the naive O(N³) form is fast enough). */
function dct2d(input: number[][]): number[][] {
  const n = input.length
  const cos = Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, i) => Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n))))
  const rows = input.map((row) => cos.map((ck) => ck.reduce((sum, c, i) => sum + c * row[i], 0)))
  return cos.map((ck) => Array.from({ length: n }, (_, col) => ck.reduce((sum, c, i) => sum + c * rows[i][col], 0)))
}

/** Step 7: 64-bit DCT perceptual hash as a '0'/'1' string (fits Postgres `bit(64)`). */
export async function phash(analysisJpeg: Buffer): Promise<string> {
  const size = 32
  const pixels = await sharp(analysisJpeg).greyscale().resize(size, size, { fit: 'fill' }).raw().toBuffer()
  const matrix = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => pixels[y * size + x]))
  const freq = dct2d(matrix)
  const low: number[] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) low.push(freq[y][x])
  const sorted = low.slice(1).sort((a, b) => a - b) // median excludes the DC term
  const median = (sorted[31] + sorted[32]) / 2
  return low.map((v) => (v > median ? '1' : '0')).join('')
}

export function hamming(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}

export type MetadataSignals = {
  has_exif: boolean
  camera_make: string | null
  camera_model: string | null
  software: string | null
  c2pa_present: boolean
}

/** Step 7: recorded for review only, never a sole decision factor. */
export async function metadataSignals(original: Buffer): Promise<MetadataSignals> {
  const meta = await sharp(original).metadata().catch(() => null)
  const tags = (await exifr.parse(original, { pick: ['Make', 'Model', 'Software'] }).catch(() => null)) as
    | { Make?: string; Model?: string; Software?: string }
    | null
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null)
  return {
    has_exif: !!meta?.exif,
    camera_make: text(tags?.Make),
    camera_model: text(tags?.Model),
    software: text(tags?.Software),
    c2pa_present: original.includes('c2pa'),
  }
}

export type Variants = { sm: Buffer; md: Buffer; lg: Buffer }
const SIZES = { sm: [400, 75], md: [1024, 80], lg: [1600, 82] } as const

/** Step 9: metadata-free WebP variants (sharp drops EXIF/XMP/IPTC unless asked to keep them). */
export async function stripAndEncode(original: Buffer): Promise<Variants> {
  const base = await sharp(original).rotate().flatten({ background: '#ffffff' }).toBuffer()
  const encode = ([edge, quality]: readonly [number, number]) =>
    sharp(base).resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer()
  const [sm, md, lg] = await Promise.all([encode(SIZES.sm), encode(SIZES.md), encode(SIZES.lg)])
  return { sm, md, lg }
}
