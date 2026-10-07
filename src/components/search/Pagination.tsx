import Link from 'next/link'

type Props = { page: number; size: number; total: number; params: Record<string, string>; basePath?: string }

function href(params: Record<string, string>, page: number, basePath: string): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== 'page' && v !== ''))
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `${basePath}?${s}` : basePath
}

/** Page numbers around the current page, always including the first and last. */
function windowed(page: number, last: number): (number | '…')[] {
  const pages = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last))
  const sorted = Array.from(pages).sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…' as const, p] : [p]))
}

const cell = 'flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm'

export function Pagination({ page, size, total, params, basePath = '/cars' }: Props) {
  const last = Math.max(1, Math.ceil(total / size))
  if (last <= 1) return null
  return (
    <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link href={href(params, page - 1, basePath)} aria-label="Previous page" className={`${cell} border-[#CBD3DF] bg-white`}>‹ Prev</Link>}
      {windowed(page, last).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-[#5A6578]">…</span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${cell} border-[#14284B] bg-[#14284B] font-semibold text-white`}>{p}</span>
        ) : (
          <Link key={p} href={href(params, p, basePath)} aria-label={`Page ${p}`} className={`${cell} border-[#CBD3DF] bg-white`}>{p}</Link>
        ),
      )}
      {page < last && <Link href={href(params, page + 1, basePath)} aria-label="Next page" className={`${cell} border-[#CBD3DF] bg-white`}>Next ›</Link>}
    </nav>
  )
}
