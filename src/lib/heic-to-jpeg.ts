/**
 * Browser-side HEIC/HEIF → JPEG conversion before upload (ADR-007: the server accepts only
 * JPEG, PNG and WebP). heic2any touches `window`, so it is imported only when needed.
 */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const UNSUPPORTED_MESSAGE = 'Only JPG, PNG, WebP or iPhone photos'

export type Prepared = { ok: true; file: File } | { ok: false; message: string }

export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

export async function prepareForUpload(file: File): Promise<Prepared> {
  if (ACCEPTED.includes(file.type)) return { ok: true, file }
  if (!isHeic(file)) return { ok: false, message: UNSUPPORTED_MESSAGE }
  try {
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const blob = Array.isArray(out) ? out[0] : out
    const name = file.name.replace(/\.hei[cf]$/i, '') + '.jpg'
    return { ok: true, file: new File([blob], name, { type: 'image/jpeg' }) }
  } catch {
    return { ok: false, message: 'We couldn’t convert this iPhone photo. Try exporting it as JPG.' }
  }
}
