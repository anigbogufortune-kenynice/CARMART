'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'
import type { Message } from '@/services/messaging.service'
import { Composer } from './Composer'

export const POLL_MS = 10_000

type Props = { conversationId: string; currentUserId: string; initial: Message[]; blocked?: boolean }

const TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }

/** One conversation: messages oldest→newest, mine on the right; refreshes every 10 s while open. */
export function ThreadView({ conversationId, currentUserId, initial, blocked = false }: Props) {
  const [messages, setMessages] = useState<Message[]>(initial)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const url = `/api/conversations/${conversationId}/messages`

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { data: Message[] }
      setMessages((current) => {
        const latest = json.data
        // Keep older pages the user already has; append anything new.
        const known = new Set(latest.map((m) => m.id))
        return [...current.filter((m) => !known.has(m.id) && m.created_at < (latest[0]?.created_at ?? '')), ...latest]
      })
    } catch {
      // Network blips are retried on the next tick.
    }
  }, [url])

  useEffect(() => {
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length])

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body.trim() }) })
      const json = (await res.json()) as { data?: Message; error?: { message: string } }
      if (res.ok && json.data) {
        const sent = json.data
        setMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]))
        setBody('')
      } else {
        setError(json.error?.message ?? 'Couldn’t send your message. Please try again.')
      }
    } catch {
      setError('Couldn’t send your message. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-[#E2E7EF] bg-white p-4">
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {messages.length === 0 && <li className="text-sm text-[#5A6578]">No messages yet.</li>}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId
          return (
            <li key={m.id} data-mine={String(mine)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? 'bg-[#14284B] text-white' : 'bg-[#EEF1F6] text-[#1B2333]'}`}>
                <span className="sr-only">{mine ? 'You: ' : 'Them: '}</span>
                <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
                <time dateTime={m.created_at} className={`mt-1 block text-xs ${mine ? 'text-white/80' : 'text-[#5A6578]'}`}>
                  {formatDate(m.created_at, TIME)}
                </time>
              </div>
            </li>
          )
        })}
      </ol>
      <div ref={endRef} />
      </div>
      {blocked ? (
        <p className="rounded-md bg-[#F4EDE1] px-4 py-3 text-sm text-[#5A4520]">This conversation has been blocked.</p>
      ) : (
        <div className="rounded-xl border border-[#E2E7EF] bg-white p-4">
          <Composer value={body} onChange={setBody} onSend={() => void send()} busy={busy} />
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </div>
  )
}
