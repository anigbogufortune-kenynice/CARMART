'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { prepareForUpload } from '@/lib/heic-to-jpeg'
import type { ImageStatus } from '@/types/domain'
import { PhotoStatusChip } from './PhotoStatusChip'

export type UploaderPhoto = {
  image_id: string
  position: number
  status: ImageStatus
  status_reason: string | null
  thumbnail_url: string | null
}

type Pending = { key: string; name: string; stage: 'Preparing' | 'Uploading' | 'Confirming' | 'Failed'; message?: string }

const MAX_PHOTOS = 20
const MIN_PHOTOS = 4
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'

const REQUEST_MESSAGES: Record<string, string> = {
  UPLOAD_LIMIT: 'Daily upload limit reached — try again tomorrow',
  PHOTO_COUNT: `This listing already has ${MAX_PHOTOS} photos`,
  INVALID_STATE: 'Photos can’t be added while this listing is being checked',
  VALIDATION_ERROR: 'Photos must be JPG, PNG or WebP and 10 MB or smaller',
  FORBIDDEN: 'Your shop can’t upload photos right now',
}
/** Errors that make every remaining file in the batch fail the same way. */
const STOP_BATCH = ['UPLOAD_LIMIT', 'PHOTO_COUNT', 'INVALID_STATE', 'FORBIDDEN']

type Props = { listingId: string; editable: boolean; pollMs?: number; onChange?: () => void }

export function PhotoUploader({ listingId, editable, pollMs = 3000, onChange }: Props) {
  const [photos, setPhotos] = useState<UploaderPhoto[] | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragged = useRef<string | null>(null)
  const changed = useRef(false)
  const base = `/api/listings/${listingId}/images`

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${base}/status`)
      const json = (await res.json()) as { data?: UploaderPhoto[] }
      if (json.data) {
        const next = json.data
        setPhotos((prev) => {
          const key = (list: UploaderPhoto[] | null) => (list ?? []).map((p) => `${p.image_id}:${p.status}`).join('|')
          if (prev !== null && key(prev) !== key(next)) changed.current = true
          return next
        })
      }
    } catch {
      // A missed poll is retried on the next tick.
    }
  }, [base])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Tell the page when photos were added, removed or decided (after the render that shows it).
  useEffect(() => {
    if (changed.current) {
      changed.current = false
      onChange?.()
    }
  })

  // Poll while any photo is being checked; stop as soon as none are.
  const checking = !!photos?.some((p) => p.status === 'checking')
  useEffect(() => {
    if (!checking) return
    const timer = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(timer)
  }, [checking, pollMs, refresh])

  const update = (key: string, patch: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const remove = (key: string) => setPending((list) => list.filter((p) => p.key !== key))

  /** One file: prepare (HEIC → JPEG) → request a signed URL → PUT → complete. Returns a batch-stopping error code, if any. */
  async function uploadOne(file: File, key: string): Promise<string | null> {
    const prepared = await prepareForUpload(file)
    if (!prepared.ok) {
      update(key, { stage: 'Failed', message: prepared.message })
      return null
    }
    update(key, { stage: 'Uploading' })
    const ticketRes = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime_type: prepared.file.type, bytes: prepared.file.size }),
    })
    const ticket = (await ticketRes.json()) as { data?: { image_id: string; upload_url: string }; error?: { code: string; message: string } }
    if (!ticket.data) {
      const code = ticket.error?.code ?? ''
      update(key, { stage: 'Failed', message: REQUEST_MESSAGES[code] ?? ticket.error?.message ?? 'Upload failed. Try again.' })
      return STOP_BATCH.includes(code) ? code : null
    }
    // A fresh signed URL per attempt: a rejected PUT is never retried on the same request.
    const body = await prepared.file.arrayBuffer()
    const put = await fetch(ticket.data.upload_url, {
      method: 'PUT', headers: { 'Content-Type': prepared.file.type, 'x-upsert': 'false' }, body,
    }).catch(() => null)
    if (!put?.ok) {
      update(key, { stage: 'Failed', message: 'Upload failed. Check your connection and try again.' })
      return null
    }
    update(key, { stage: 'Confirming' })
    const done = await fetch(`${base}/${ticket.data.image_id}/complete`, { method: 'POST' })
    if (!done.ok) {
      update(key, { stage: 'Failed', message: 'We didn’t receive that photo. Please try again.' })
      return null
    }
    remove(key)
    await refresh()
    return null
  }

  async function addFiles(files: File[]) {
    if (!files.length) return
    setNotice(null)
    const batch = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, stage: 'Preparing' as const }))
    setPending((list) => [...list, ...batch])
    for (let i = 0; i < files.length; i++) {
      let stop: string | null = null
      try {
        stop = await uploadOne(files[i], batch[i].key)
      } catch {
        update(batch[i].key, { stage: 'Failed', message: 'Upload failed. Try again.' })
      }
      if (stop) {
        setNotice(REQUEST_MESSAGES[stop])
        for (const rest of batch.slice(i + 1)) remove(rest.key)
        break
      }
    }
  }

  async function saveOrder(next: UploaderPhoto[]) {
    const previous = photos
    setPhotos(next.map((p, position) => ({ ...p, position })))
    const res = await fetch(`${base}/order`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_ids: next.map((p) => p.image_id) }),
    }).catch(() => null)
    if (!res?.ok) {
      setPhotos(previous)
      setNotice('Couldn’t save the new order. Reload and try again.')
    }
  }

  function move(index: number, to: number) {
    if (!photos || to < 0 || to >= photos.length) return
    const next = photos.slice()
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    void saveOrder(next)
  }

  async function del(photo: UploaderPhoto, index: number) {
    if (!window.confirm(`Delete photo ${index + 1}? This can’t be undone.`)) return
    const res = await fetch(`${base}/${photo.image_id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null
      setNotice(json?.error?.message ?? 'Couldn’t delete the photo.')
      return
    }
    await refresh()
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void addFiles(Array.from(e.dataTransfer.files))
  }

  const list = photos ?? []
  const passed = list.filter((p) => p.status === 'passed').length

  return (
    <section aria-labelledby="photos-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="photos-heading" className="text-lg font-semibold">Photos</h2>
        <p className="text-sm text-gray-700">{list.length} / {MAX_PHOTOS} photos (min {MIN_PHOTOS})</p>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Real photos of this car only. Each photo is checked automatically; AI-generated or non-car images are refused.
        {list.length > 0 && ` ${passed} passed.`}
      </p>

      {editable && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 rounded border-2 border-dashed px-4 py-8 text-center ${dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300'}`}
        >
          <p className="text-sm text-gray-700">Drag photos here, or</p>
          <label htmlFor="photo-files" className="mt-2 inline-block cursor-pointer rounded bg-gray-900 px-4 py-2 text-sm text-white focus-within:ring-2">
            Add photos
          </label>
          <input id="photo-files" type="file" multiple accept={ACCEPT} className="sr-only"
            onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <p className="mt-2 text-xs text-gray-500">JPG, PNG, WebP or iPhone (HEIC) photos, up to 10 MB each, at least 800×600.</p>
        </div>
      )}

      {notice && <p role="alert" className="mt-3 text-sm text-red-700">{notice}</p>}

      {pending.length > 0 && (
        <ul aria-label="Uploads in progress" className="mt-4 space-y-1 text-sm">
          {pending.map((p) => (
            <li key={p.key} className={p.stage === 'Failed' ? 'text-red-700' : 'text-gray-700'}>
              {p.name}: {p.stage === 'Failed' ? p.message : `${p.stage}…`}
            </li>
          ))}
        </ul>
      )}

      <ol aria-label="Photos" className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((p, i) => (
          <li key={p.image_id} draggable={editable}
            onDragStart={() => { dragged.current = p.image_id }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const from = list.findIndex((x) => x.image_id === dragged.current)
              dragged.current = null
              if (from >= 0 && from !== i) move(from, i)
            }}
            className="rounded border border-gray-200 p-2">
            <div className="aspect-[4/3] overflow-hidden rounded bg-gray-100">
              {p.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; next/image can't cache them
                <img src={p.thumbnail_url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <PhotoStatusChip status={p.status} reason={p.status_reason} />
              {i === 0 && <span className="text-xs text-gray-500">Cover</span>}
            </div>
            {editable && (
              <div className="mt-2 flex gap-2 text-xs">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}
                  className="rounded border px-2 py-1 disabled:opacity-40">←</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move photo ${i + 1} later`}
                  className="rounded border px-2 py-1 disabled:opacity-40">→</button>
                <button type="button" onClick={() => void del(p, i)} aria-label={`Delete photo ${i + 1}`}
                  className="ml-auto rounded border border-red-200 px-2 py-1 text-red-800">Delete</button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
