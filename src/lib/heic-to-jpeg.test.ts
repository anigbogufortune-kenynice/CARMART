import { afterEach, describe, expect, it, vi } from 'vitest'
import { isHeic, prepareForUpload } from './heic-to-jpeg'

// heic2any is a third-party browser library (decodes HEIC in a worker): stubbed at its boundary.
const { heic2any } = vi.hoisted(() => ({ heic2any: vi.fn() }))
vi.mock('heic2any', () => ({ default: heic2any }))

afterEach(() => heic2any.mockReset())

describe('prepareForUpload (ADR-007)', () => {
  it('converts a HEIC file (type often empty) to a JPEG File with a .jpg name', async () => {
    heic2any.mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))
    const out = await prepareForUpload(new File(['heic-bytes'], 'IMG_1.HEIC', { type: '' }))
    expect(heic2any).toHaveBeenCalledWith(expect.objectContaining({ toType: 'image/jpeg' }))
    expect(out).toMatchObject({ ok: true })
    if (!out.ok) return
    expect(out.file.type).toBe('image/jpeg')
    expect(out.file.name).toBe('IMG_1.jpg')
  })

  it('returns JPEG/PNG/WebP files unchanged', async () => {
    const jpg = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    expect(await prepareForUpload(jpg)).toEqual({ ok: true, file: jpg })
    expect(heic2any).not.toHaveBeenCalled()
  })

  it('refuses other types', async () => {
    expect(await prepareForUpload(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))).toEqual({
      ok: false, message: 'Only JPG, PNG, WebP or iPhone photos',
    })
    expect(await prepareForUpload(new File(['x'], 'anim.gif', { type: 'image/gif' }))).toMatchObject({ ok: false })
  })

  it('reports a conversion failure plainly', async () => {
    heic2any.mockRejectedValue(new Error('decode failed'))
    expect(await prepareForUpload(new File(['x'], 'IMG_2.heif', { type: 'image/heif' }))).toEqual({
      ok: false, message: 'We couldn’t convert this iPhone photo. Try exporting it as JPG.',
    })
  })

  it('isHeic detects by type or extension', () => {
    expect(isHeic(new File([''], 'a.HEIC', { type: '' }))).toBe(true)
    expect(isHeic(new File([''], 'a', { type: 'image/heif' }))).toBe(true)
    expect(isHeic(new File([''], 'a.jpg', { type: 'image/jpeg' }))).toBe(false)
  })
})
