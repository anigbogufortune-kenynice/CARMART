'use client'

import { useState, type KeyboardEvent } from 'react'
import type { PublicPhoto } from '@/services/search.service'

/** Listing photos: one large image (md/lg via srcset) with thumbnails; ←/→ move between photos. */
export function PhotoGallery({ title, photos }: { title: string; photos: PublicPhoto[] }) {
  const [index, setIndex] = useState(0)
  if (photos.length === 0) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[#EEF1F6] text-[#5A6578]">No photos yet</div>
  }
  const total = photos.length
  const current = photos[Math.min(index, total - 1)]
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total)

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }

  return (
    <section aria-label="Photos" tabIndex={0} onKeyDown={onKeyDown}
      className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B8924F]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#0E1D38]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized public WebP variants */}
        <img key={current.id} src={current.urls.lg} srcSet={`${current.urls.md} 1024w, ${current.urls.lg} 1600w`}
          sizes="(min-width: 1024px) 720px, 100vw" alt={`${title} photo ${index + 1} of ${total}`}
          className="h-full w-full object-contain" />
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg text-[#14284B] shadow">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg text-[#14284B] shadow">›</button>
            <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{index + 1} / {total}</span>
          </>
        )}
      </div>
      {total > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <li key={p.id} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                className={`block h-16 w-20 overflow-hidden rounded-md border-2 ${i === index ? 'border-[#B8924F]' : 'border-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail variant */}
                <img src={p.urls.sm} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
