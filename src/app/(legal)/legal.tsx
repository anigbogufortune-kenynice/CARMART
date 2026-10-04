import type { ReactNode } from 'react'
import { formatDate } from '@/lib/format'

/** Shared bits for the legal and trust pages (issue 031). */

export const LAST_UPDATED = '2026-10-04'
export const supportEmail = () => process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@carmart.example'

/** Shown until a lawyer has reviewed the pages and LEGAL_REVIEWED=true is set. */
export const legalReviewed = () => process.env.LEGAL_REVIEWED === 'true'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-[#1B2333]">
      {!legalReviewed() && (
        <p role="note" className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
          Draft — pending legal review
        </p>
      )}
      <h1 className="text-3xl font-semibold text-[#14284B]">{title}</h1>
      <p className="mt-2 text-sm text-[#5A6578]">Last updated {formatDate(`${LAST_UPDATED}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div className="legal mt-8 space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#14284B] [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
        {children}
      </div>
    </article>
  )
}

export function Email() {
  const e = supportEmail()
  return <a href={`mailto:${e}`}>{e}</a>
}
