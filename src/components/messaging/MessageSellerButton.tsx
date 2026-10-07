'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Composer, MAX_MESSAGE } from './Composer'

type Props = { listingId: string; title: string; signedIn: boolean }

const ERRORS: Record<string, string> = {
  CONVERSATION_LIMIT: 'You’ve started a lot of conversations today — try again tomorrow',
  RATE_LIMITED: 'You’re sending messages too quickly. Wait a little, then try again.',
  CONVERSATION_BLOCKED: 'This seller can’t receive messages from you',
  OWN_LISTING: 'This is your own listing',
  FORBIDDEN: 'Your account can’t send messages right now',
  NOT_FOUND: 'This car is no longer available',
}

const buttonClass = 'block w-full rounded-md bg-[#14284B] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#0E1D38] disabled:opacity-60'

/** "Message seller" on a car page: visitors go to sign in; signed-in buyers get a prefilled composer. */
export function MessageSellerButton({ listingId, title, signedIn }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(`Hi, is the ${title} still available?`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return <Link href={`/sign-in?next=${encodeURIComponent(`/cars/${listingId}`)}`} className={buttonClass}>Message seller</Link>
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={buttonClass}>Message seller</button>
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, body: body.trim() }),
      })
      const json = (await res.json()) as { data?: { conversation_id: string }; error?: { code: string } }
      if (res.ok && json.data) {
        router.push(`/account/messages/${json.data.conversation_id}`)
        return
      }
      setError(ERRORS[json.error?.code ?? ''] ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="rounded-md border border-[#CBD3DF] p-3">
      <Composer value={body} onChange={setBody} onSend={() => void send()} busy={busy} max={MAX_MESSAGE} autoFocus />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
