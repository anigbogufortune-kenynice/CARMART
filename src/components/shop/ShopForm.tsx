'use client'

import { useState, type FormEvent } from 'react'
import { NG_STATES, ShopCreateSchema, ShopUpdateSchema, stateLabel } from '@/types/domain'

export type ShopFormShop = {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  state: string
  status: string
  show_phone: boolean
}

type Field = 'name' | 'slug' | 'city' | 'state' | 'description'

const SERVER_MESSAGES: Record<string, string> = {
  SLUG_TAKEN: 'That web address is taken — try another',
  SLUG_LOCKED: 'The web address can’t be changed after you submit your shop.',
  SHOP_ALREADY_EXISTS: 'You already have a shop',
  UNAUTHENTICATED: 'Sign in to create a shop',
  EMAIL_NOT_VERIFIED: 'Verify your email before creating a shop',
  FORBIDDEN: 'This shop can’t be changed right now',
}

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

type Props =
  | { mode: 'create'; shop?: undefined; onSaved: (shop: { slug: string }) => void }
  | { mode: 'edit'; shop: ShopFormShop; onSaved: (shop: ShopFormShop) => void }

export function ShopForm({ mode, shop, onSaved }: Props) {
  const slugLocked = mode === 'edit' && !['draft', 'rejected'].includes(shop.status)
  const [name, setName] = useState(shop?.name ?? '')
  const [slug, setSlug] = useState(shop?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showPhone, setShowPhone] = useState(shop?.show_phone ?? false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  /** Saved on its own, straight away, so it doesn't depend on the rest of the form. */
  async function toggleShowPhone(next: boolean) {
    setShowPhone(next)
    setPhoneError(null)
    try {
      const res = await fetch('/api/shops/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ show_phone: next }),
      })
      if (res.ok) return
    } catch {
      // handled below
    }
    setShowPhone(!next)
    setPhoneError('Couldn’t update this setting. Please try again.')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSaved(false)
    const form = new FormData(event.currentTarget)
    const description = String(form.get('description') ?? '').trim()
    const values = {
      name, slug,
      city: String(form.get('city') ?? ''),
      state: String(form.get('state') ?? ''),
    }

    let payload: Record<string, unknown>
    if (mode === 'create') {
      const parsed = ShopCreateSchema.safeParse({ ...values, ...(description ? { description } : {}) })
      if (!parsed.success) return showErrors(parsed.error.issues)
      payload = parsed.data
    } else {
      const changed: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(values)) if (v !== shop[k as keyof ShopFormShop]) changed[k] = v
      if ((description || null) !== (shop.description || null)) changed.description = description || null
      if (slugLocked) delete changed.slug
      const parsed = ShopUpdateSchema.safeParse(changed)
      if (!parsed.success) return showErrors(parsed.error.issues)
      payload = parsed.data
      if (Object.keys(payload).length === 0) {
        setSaved(true)
        return
      }
    }
    setErrors({})

    const res = await fetch(mode === 'create' ? '/api/shops' : '/api/shops/me', {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json()) as { data?: ShopFormShop; error?: { code: string; message: string } }
    if (!json.data) {
      setFormError(SERVER_MESSAGES[json.error?.code ?? ''] ?? json.error?.message ?? 'Something went wrong')
      return
    }
    setSaved(mode === 'edit')
    if (mode === 'create') onSaved(json.data)
    else onSaved(json.data)
  }

  function showErrors(issues: { path: PropertyKey[]; message: string }[]) {
    const next: Partial<Record<Field, string>> = {}
    for (const issue of issues) next[issue.path[0] as Field] ??= issue.message
    setErrors(next)
  }

  const error = (f: Field) => errors[f] && <p id={`${f}-error`} className="mt-1 text-sm text-red-700">{errors[f]}</p>
  const input = 'mt-1 w-full rounded border border-gray-300 px-3 py-2'

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">Shop name</label>
        <input id="name" value={name} className={input} aria-invalid={!!errors.name}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
        {error('name')}
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium">Shop web address</label>
        <div className="mt-1 text-sm text-gray-500">carmart.example/shops/</div>
        <input id="slug" value={slug} readOnly={slugLocked} className={`${input} ${slugLocked ? 'bg-gray-100' : ''}`}
          aria-invalid={!!errors.slug} aria-describedby={errors.slug ? 'slug-error' : slugLocked ? 'slug-locked' : undefined}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }} />
        {slugLocked && <p id="slug-locked" className="mt-1 text-sm text-gray-600">The web address can’t be changed after you submit your shop.</p>}
        {error('slug')}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">About your shop (optional)</label>
        <textarea id="description" name="description" maxLength={1000} rows={3} defaultValue={shop?.description ?? ''} className={input} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="block text-sm font-medium">City or area</label>
          <input id="city" name="city" placeholder="e.g. Ikeja" defaultValue={shop?.city ?? ''} className={input} aria-invalid={!!errors.city} />
          {error('city')}
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium">State</label>
          <select id="state" name="state" defaultValue={shop?.state ?? ''} className={input} aria-invalid={!!errors.state}>
            <option value="" disabled>Choose…</option>
            {NG_STATES.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
          </select>
          {error('state')}
        </div>
      </div>
      {mode === 'edit' && (
        <div className="rounded border border-gray-200 bg-white px-3 py-3">
          <div className="flex items-start gap-3 text-sm">
            <input id="show-phone" type="checkbox" checked={showPhone} aria-describedby="show-phone-help"
              onChange={(e) => void toggleShowPhone(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <div>
              <label htmlFor="show-phone" className="font-medium">Show my phone number to signed-in buyers</label>
              <p id="show-phone-help" className="text-gray-600">Buyers who are signed in can tap to see and call your verified number. Off by default.</p>
            </div>
          </div>
          {phoneError && <p role="alert" className="mt-2 text-sm text-red-700">{phoneError}</p>}
        </div>
      )}
      {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Saved</p>}
      <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">{mode === 'create' ? 'Create shop' : 'Save changes'}</button>
    </form>
  )
}
