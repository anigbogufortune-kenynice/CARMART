// @vitest-environment node
import { readFileSync } from 'node:fs'
import exifr from 'exifr'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { hamming, metadataSignals, normalise, phash, stripAndEncode, validate, VALIDATION_REASONS } from './process-image'

const fixture = (name: string) => readFileSync(`tests/fixtures/images/${name}`)

describe('validate (step 5, D1)', () => {
  it('accepts a real photo and reports its size', async () => {
    expect(await validate(fixture('car-exterior.jpg'), 'image/jpeg')).toEqual({ ok: true, width: 1600, height: 1200 })
  })
  it('rejects small, animated and undecodable files', async () => {
    expect(await validate(fixture('tiny.jpg'), 'image/jpeg')).toEqual({ ok: false, reason: 'Photo is too small (minimum 800×600).' })
    expect(await validate(fixture('animated.webp'), 'image/webp')).toEqual({ ok: false, reason: VALIDATION_REASONS.animated })
    expect(await validate(fixture('not-an-image.jpg'), 'image/jpeg')).toEqual({ ok: false, reason: VALIDATION_REASONS.unreadable })
  })
  it('rejects a decoded format that differs from the declared type (EC-I3)', async () => {
    expect(await validate(fixture('car-exterior.jpg'), 'image/png')).toEqual({ ok: false, reason: VALIDATION_REASONS.unreadable })
  })
  it('accepts portrait orientation at 600×800', async () => {
    const portrait = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#888' } }).jpeg().toBuffer()
    expect(await validate(portrait, 'image/jpeg')).toMatchObject({ ok: true })
  })
})

describe('phash / hamming', () => {
  it('is a stable 64-bit string that survives re-encoding', async () => {
    const original = await normalise(fixture('car-exterior.jpg'))
    const a = await phash(original)
    expect(a).toMatch(/^[01]{64}$/)
    expect(await phash(original)).toBe(a)
    const reencoded = await normalise(await sharp(fixture('car-exterior.jpg')).jpeg({ quality: 60 }).toBuffer())
    expect(hamming(a, await phash(reencoded))).toBeLessThanOrEqual(6)
  })
  it('tells different fixtures apart', async () => {
    const a = await phash(await normalise(fixture('car-exterior.jpg')))
    const b = await phash(await normalise(fixture('dog.jpg')))
    expect(hamming(a, b)).toBeGreaterThan(6)
  })
})

describe('stripAndEncode (step 9, INV-I2)', () => {
  it('removes EXIF/GPS/XMP/IPTC from every variant', async () => {
    expect(await exifr.gps(fixture('with-gps.jpg'))).toBeTruthy()
    const variants = await stripAndEncode(fixture('with-gps.jpg'))
    for (const buf of Object.values(variants)) {
      const meta = await sharp(buf).metadata()
      expect(meta.format).toBe('webp')
      expect(meta.exif).toBeUndefined()
      expect(meta.xmp).toBeUndefined()
      expect(meta.iptc).toBeUndefined()
      expect(await exifr.parse(buf).catch(() => undefined)).toBeFalsy()
    }
  })
  it('resizes to 400/1024/1600 on the long edge without enlarging', async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#357' } }).jpeg().toBuffer()
    const v = await stripAndEncode(big)
    expect((await sharp(v.sm).metadata()).width).toBe(400)
    expect((await sharp(v.md).metadata()).width).toBe(1024)
    expect((await sharp(v.lg).metadata()).width).toBe(1600)
    const small = await stripAndEncode(fixture('car-exterior.jpg'))
    expect((await sharp(small.lg).metadata()).width).toBe(1600)
  })
})

describe('normalise / metadataSignals', () => {
  it('produces a JPEG no larger than 1568 px', async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#357' } }).png().toBuffer()
    const meta = await sharp(await normalise(big)).metadata()
    expect(meta.format).toBe('jpeg')
    expect(Math.max(meta.width!, meta.height!)).toBe(1568)
  })
  it('records camera metadata from the original', async () => {
    expect(await metadataSignals(fixture('with-gps.jpg'))).toEqual({
      has_exif: true, camera_make: 'Canon', camera_model: 'EOS Test', software: null, c2pa_present: false,
    })
    expect(await metadataSignals(fixture('car-exterior.jpg'))).toMatchObject({ has_exif: false, camera_make: null })
  })
})

describe('fixture set', () => {
  it('distinct fixtures are further apart than phash_max_distance (6), so tests never see false reuse', async () => {
    const names = ['car-exterior.jpg', 'car-interior.jpg', 'dog.jpg', 'ai-car.jpg', 'borderline-ai.jpg', 'screen-photo.jpg', 'vendor-error.jpg', 'with-gps.jpg']
    const hashes = await Promise.all(names.map(async (n) => phash(await normalise(fixture(n)))))
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) expect(hamming(hashes[i], hashes[j]), `${names[i]} vs ${names[j]}`).toBeGreaterThan(12)
    }
  })
})
