'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { AU_STATES, ShopCreateSchema } from '@/types/domain'

type Field = 'name' | 'slug' | 'suburb' | 'state' | 'postcode' | 'description'

const SERVER_MESSAGES: Record<string, string> = {
  SLUG_TAKEN: 'That web address is taken — try another',
  SHOP_ALREADY_EXISTS: 'You already have a shop',
  POSTCODE_STATE_MISMATCH: 'That postcode is not in the selected state',
  UNAUTHENTICATED: 'Sign in to create a shop',
  EMAIL_NOT_VERIFIED: 'Verify your email before creating a shop',
}

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

export default function ShopPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ slug: string } | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const form = new FormData(event.currentTarget)
    const description = String(form.get('description') ?? '').trim()
    const candidate = {
      name, slug,
      suburb: String(form.get('suburb') ?? ''),
      state: String(form.get('state') ?? ''),
      postcode: String(form.get('postcode') ?? ''),
      ...(description ? { description } : {}),
    }
    const parsed = ShopCreateSchema.safeParse(candidate)
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message
      setErrors(next)
      return
    }
    setErrors({})
    const res = await fetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    const json = (await res.json()) as { data?: { slug: string }; error?: { code: string; message: string } }
    if (json.data) setCreated(json.data)
    else setFormError(SERVER_MESSAGES[json.error?.code ?? ''] ?? json.error?.message ?? 'Something went wrong')
  }

  if (created) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold">Shop created (draft)</h1>
        <p className="mt-3 text-gray-700">
          Next, verify your mobile number and submit your shop for approval. You can start drafting car listings now.
        </p>
        <Link href="/sell" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white">Back to your checklist</Link>
      </main>
    )
  }

  const error = (f: Field) =>
    errors[f] && <p id={`${f}-error`} className="mt-1 text-sm text-red-700">{errors[f]}</p>
  const input = 'mt-1 w-full rounded border border-gray-300 px-3 py-2'

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">Create your shop</h1>
      <p className="mt-2 text-sm text-gray-600">Your shop goes public once your phone is verified and our team approves it.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">Shop name</label>
          <input id="name" value={name} className={input} aria-invalid={!!errors.name}
            onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
          {error('name')}
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium">Shop web address</label>
          <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">carmart.example/shops/</div>
          <input id="slug" value={slug} className={input} aria-invalid={!!errors.slug} aria-describedby={errors.slug ? 'slug-error' : undefined}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }} />
          {error('slug')}
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">About your shop (optional)</label>
          <textarea id="description" name="description" maxLength={1000} rows={3} className={input} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="suburb" className="block text-sm font-medium">Suburb</label>
            <input id="suburb" name="suburb" className={input} aria-invalid={!!errors.suburb} />
            {error('suburb')}
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium">State</label>
            <select id="state" name="state" defaultValue="" className={input} aria-invalid={!!errors.state}>
              <option value="" disabled>Choose…</option>
              {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {error('state')}
          </div>
          <div>
            <label htmlFor="postcode" className="block text-sm font-medium">Postcode</label>
            <input id="postcode" name="postcode" inputMode="numeric" maxLength={4} className={input} aria-invalid={!!errors.postcode} />
            {error('postcode')}
          </div>
        </div>
        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Create shop</button>
      </form>
    </main>
  )
}
