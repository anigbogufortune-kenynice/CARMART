'use client'

import { useEffect, useState, type FormEvent } from 'react'

type Me = { display_name: string; phone: string | null; phone_verified: boolean }

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile/me')
      .then((r) => r.json())
      .then((j: { data?: Me }) => setMe(j.data ?? null))
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const display_name = String(new FormData(event.currentTarget).get('display_name') ?? '')
    const res = await fetch('/api/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name }),
    })
    const j = (await res.json()) as { data?: Me; error?: { message: string } }
    if (j.data) {
      setMe(j.data)
      setStatus('Saved')
    } else setStatus(j.error?.message ?? 'Could not save')
  }

  if (!me) return <main className="mx-auto max-w-md px-4 py-12">Loading…</main>

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium">Display name</label>
          <input id="display_name" name="display_name" defaultValue={me.display_name} maxLength={60} required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
        {status && <p role="status" className="text-sm">{status}</p>}
      </form>
      <p className="mt-6 text-sm text-gray-600">
        Phone: {me.phone_verified ? me.phone : 'not verified'}
      </p>
    </main>
  )
}
