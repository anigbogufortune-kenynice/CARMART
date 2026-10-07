import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { ConversationSummary } from '@/services/messaging.service'

type Props = { items: ConversationSummary[]; basePath: string; empty?: string }

const TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }

/** Inbox rows: listing thumbnail and title, the other party, last message preview, time, unread dot. */
export function ConversationList({ items, basePath, empty = 'No messages yet.' }: Props) {
  if (items.length === 0) return <p className="mt-6 rounded-xl border border-[#E2E7EF] bg-white px-5 py-8 text-center text-[#5A6578]">{empty}</p>
  return (
    <ul className="mt-6 divide-y divide-[#E2E7EF] overflow-hidden rounded-xl border border-[#E2E7EF] bg-white">
      {items.map((c) => {
        const unread = c.unread_count > 0
        return (
          <li key={c.id}>
            <Link href={`${basePath}/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#F6F8FB]">
              {c.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.thumbnail_url} alt="" className="h-14 w-20 flex-none rounded object-cover" />
                : <span aria-hidden className="h-14 w-20 flex-none rounded bg-[#EEF1F6]" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`truncate ${unread ? 'font-semibold text-[#1B2333]' : 'text-[#1B2333]'}`}>{c.listing_title}</span>
                  <time dateTime={c.last_message_at} className="flex-none text-xs text-[#5A6578]">{formatDate(c.last_message_at, TIME)}</time>
                </span>
                <span className="block truncate text-sm text-[#5A6578]">{c.other_party}{c.listing_status === 'sold' ? ' · Sold' : ''}</span>
                {c.last_message && (
                  <span className={`block truncate text-sm ${unread ? 'text-[#1B2333]' : 'text-[#5A6578]'}`}>
                    {c.last_message.mine ? 'You: ' : ''}{c.last_message.body}
                  </span>
                )}
              </span>
              {unread && <span aria-label={`${c.unread_count} unread`} role="status" className="h-2.5 w-2.5 flex-none rounded-full bg-[#B8924F]" />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
