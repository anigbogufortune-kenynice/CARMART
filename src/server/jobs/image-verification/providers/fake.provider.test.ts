// @vitest-environment node
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { FakeAiCheckProvider, FakeCarCheckProvider } from './fake.provider'

const fixture = (name: string) => readFileSync(`tests/fixtures/images/${name}`)
// The pipeline sends the car check a re-encoded 1568px JPEG, so the fake must survive that.
const reencode = (buf: Buffer) => sharp(buf).resize({ width: 1568, height: 1568, fit: 'inside' }).jpeg({ quality: 85 }).toBuffer()

describe('fake providers (driven by tests/fixtures/images/manifest.json)', () => {
  const car = new FakeCarCheckProvider({ strict: false })
  const ai = new FakeAiCheckProvider({ strict: false })

  it('car check: dog.jpg is not a car, even after re-encoding', async () => {
    const r = await car.check(await reencode(fixture('dog.jpg')))
    expect(r).toMatchObject({ ok: true, value: { provider: 'fake', isCar: false, confidence: 0.95 } })
  })

  it('car check: car-exterior.jpg is a confident exterior car', async () => {
    expect(await car.check(await reencode(fixture('car-exterior.jpg')))).toMatchObject({
      ok: true,
      value: { isCar: true, view: 'exterior' },
    })
  })

  it('AI check: ai-car.jpg scores 0.95', async () => {
    expect(await ai.check(fixture('ai-car.jpg'), 'image/jpeg')).toMatchObject({ ok: true, value: { provider: 'fake', score: 0.95 } })
  })

  it('vendor-error.jpg returns VENDOR_ERROR from both providers', async () => {
    expect(await ai.check(fixture('vendor-error.jpg'), 'image/jpeg')).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR' } })
    expect(await car.check(fixture('vendor-error.jpg'))).toMatchObject({ ok: false, error: { code: 'VENDOR_ERROR' } })
  })

  it('unknown images pass in local mode and fail in strict (CI) mode', async () => {
    const unknown = await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 7, g: 200, b: 90 } } }).jpeg().toBuffer()
    expect(await ai.check(unknown, 'image/jpeg')).toMatchObject({ ok: true, value: { score: 0.01 } })
    const strict = new FakeAiCheckProvider({ strict: true })
    expect(await strict.check(unknown, 'image/jpeg')).toMatchObject({ ok: false, error: { code: 'UNKNOWN_FIXTURE' } })
  })
})
