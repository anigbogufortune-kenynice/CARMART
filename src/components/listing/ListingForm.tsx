'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  AU_STATES, BODY_TYPES, BODY_TYPE_LABELS, FUELS, FUEL_LABELS, ListingDraftSchema, TRANSMISSIONS, TRANSMISSION_LABELS,
} from '@/types/domain'

/** The editable fields of a listing, as the owner API returns them. */
export type ListingFormListing = {
  id: string
  version: number
  make_id: string | null
  model_id: string | null
  make_other: string | null
  model_other: string | null
  year: number | null
  odometer_km: number | null
  price_cents: number | null
  body_type: string | null
  transmission: string | null
  fuel: string | null
  colour: string | null
  vin: string | null
  rego: string | null
  rego_expiry: string | null
  description: string
  state: string | null
  suburb: string | null
  postcode: string | null
}

type Props =
  | { mode: 'create'; listing?: undefined; onSaved: (listing: { id: string; version: number }) => void }
  | { mode: 'edit'; listing: ListingFormListing; onSaved: (listing: ListingFormListing) => void }

type Ref = { id: string; name: string }
type Field =
  | 'make' | 'model' | 'year' | 'odometer_km' | 'price' | 'body_type' | 'transmission' | 'fuel' | 'colour'
  | 'vin' | 'rego' | 'rego_expiry' | 'description' | 'state' | 'suburb' | 'postcode'

const OTHER = '__other'
const DESCRIPTION_MAX = 5000

/** Error codes that belong to one field (server and browser validation share them). */
const CODE_FIELD: Record<string, [Field, string]> = {
  INVALID_VIN: ['vin', 'Enter a valid 17-character VIN'],
  MAKE_REQUIRED: ['make', 'Choose a make, or pick Other… and type it'],
  MODEL_REQUIRED: ['model', 'Choose a model, or pick Other… and type it'],
  POSTCODE_STATE_MISMATCH: ['postcode', 'That postcode is not in the selected state'],
}

/** Plain-language message per field for generic validation failures. */
const FIELD_HINT: Record<Field, string> = {
  make: 'Choose a make', model: 'Choose a model',
  year: `Enter a year from 1900 to ${new Date().getFullYear() + 1}`,
  odometer_km: 'Enter kilometres from 0 to 2,000,000',
  price: 'Enter a price from $1 to $10,000,000',
  body_type: 'Choose a body type', transmission: 'Choose a transmission', fuel: 'Choose a fuel type',
  colour: 'Enter a colour (2–30 characters)', vin: 'Enter a valid 17-character VIN',
  rego: 'Rego is up to 9 letters and numbers', rego_expiry: 'Enter a valid date',
  description: `Keep the description under ${DESCRIPTION_MAX} characters`,
  state: 'Choose a state', suburb: 'Enter a suburb', postcode: 'Enter a 4-digit postcode',
}

/** API field name → form field. */
const API_FIELD: Record<string, Field> = {
  make_id: 'make', make_other: 'make', model_id: 'model', model_other: 'model', price_cents: 'price',
  year: 'year', odometer_km: 'odometer_km', body_type: 'body_type', transmission: 'transmission', fuel: 'fuel',
  colour: 'colour', vin: 'vin', rego: 'rego', rego_expiry: 'rego_expiry', description: 'description',
  state: 'state', suburb: 'suburb', postcode: 'postcode',
}

const SERVER_MESSAGES: Record<string, string> = {
  SHOP_NOT_FOUND: 'Create your shop before listing a car',
  FORBIDDEN: 'Your shop can’t list cars right now',
  INVALID_STATE: 'This listing can’t be edited right now',
  VERSION_CONFLICT: 'This listing changed in another tab. Reload the page and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again.',
  EMAIL_NOT_VERIFIED: 'Verify your email before listing a car',
}

const dollars = (cents: number | null) =>
  cents == null ? '' : (cents / 100).toLocaleString('en-AU', { maximumFractionDigits: 2 })

/** '45,990' / '$45 990.50' → cents, or NaN. */
function toCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN
  return Math.round(Number(cleaned) * 100)
}

export function ListingForm({ mode, listing, onSaved }: Props) {
  const [makes, setMakes] = useState<Ref[]>([])
  const [models, setModels] = useState<Ref[]>([])
  const [makeChoice, setMakeChoice] = useState(listing?.make_other ? OTHER : listing?.make_id ?? '')
  const [modelChoice, setModelChoice] = useState(listing?.model_other ? OTHER : listing?.model_id ?? '')
  const [makeOther, setMakeOther] = useState(listing?.make_other ?? '')
  const [modelOther, setModelOther] = useState(listing?.model_other ?? '')
  const [vin, setVin] = useState(listing?.vin ?? '')
  const [price, setPrice] = useState(dollars(listing?.price_cents ?? null))
  const [description, setDescription] = useState(listing?.description ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/vehicle-makes')
      .then((r) => r.json())
      .then((j: { data?: Ref[] }) => setMakes(j.data ?? []))
      .catch(() => setFormError('Couldn’t load the list of makes. Reload the page to try again.'))
  }, [])

  const makeIsListed = makeChoice !== '' && makeChoice !== OTHER
  useEffect(() => {
    setModels([])
    if (!makeIsListed) return
    fetch(`/api/vehicle-makes/${makeChoice}/models`)
      .then((r) => r.json())
      .then((j: { data?: Ref[] }) => setModels(j.data ?? []))
      .catch(() => setFormError('Couldn’t load the models. Reload the page to try again.'))
  }, [makeChoice, makeIsListed])

  function buildPayload(form: FormData): Record<string, unknown> | Partial<Record<Field, string>> {
    const text = (name: string) => String(form.get(name) ?? '').trim()
    const payload: Record<string, unknown> = {}
    const bad: Partial<Record<Field, string>> = {}

    if (makeChoice === OTHER) Object.assign(payload, { make_id: null, make_other: makeOther.trim() || null })
    else Object.assign(payload, { make_id: makeChoice || null, make_other: null })
    const modelIsOther = makeChoice === OTHER || modelChoice === OTHER
    if (modelIsOther) Object.assign(payload, { model_id: null, model_other: modelOther.trim() || null })
    else Object.assign(payload, { model_id: modelChoice || null, model_other: null })

    for (const name of ['year', 'odometer_km'] as const) {
      const v = text(name).replace(/[,\s]/g, '')
      if (!v) continue
      if (!/^\d+$/.test(v)) bad[name] = FIELD_HINT[name]
      else payload[name] = Number(v)
    }
    if (price.trim()) {
      const cents = toCents(price)
      if (Number.isNaN(cents)) bad.price = FIELD_HINT.price
      else payload.price_cents = cents
    }
    for (const name of ['body_type', 'transmission', 'fuel', 'state', 'colour', 'rego', 'rego_expiry', 'suburb', 'postcode'] as const) {
      const v = text(name)
      if (v) payload[name] = v
    }
    if (vin.trim()) payload.vin = vin.trim()
    if (description.trim() || mode === 'edit') payload.description = description.trim()
    return Object.keys(bad).length ? { __bad: bad } : payload
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSaved(false)
    const built = buildPayload(new FormData(event.currentTarget))
    if ('__bad' in built) return setErrors(built.__bad as Partial<Record<Field, string>>)
    const parsed = ListingDraftSchema.safeParse(built)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues))
    setErrors({})

    setSaving(true)
    try {
      const res = await fetch(mode === 'create' ? '/api/listings' : `/api/listings/${listing.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? parsed.data : { ...parsed.data, version: listing.version }),
      })
      const json = (await res.json()) as { data?: ListingFormListing; error?: { code: string; message: string } }
      if (!json.data) return showServerError(json.error)
      if (mode === 'create') onSaved(json.data)
      else {
        setSaved(true)
        onSaved(json.data)
      }
    } catch {
      setFormError('Couldn’t save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
    const next: Partial<Record<Field, string>> = {}
    for (const issue of issues) {
      const coded = CODE_FIELD[issue.message]
      if (coded) next[coded[0]] ??= coded[1]
      else {
        const field = API_FIELD[String(issue.path[0])]
        if (field) next[field] ??= FIELD_HINT[field]
      }
    }
    return next
  }

  function showServerError(error?: { code: string; message: string }) {
    const code = error?.code ?? ''
    if (CODE_FIELD[code]) return setErrors({ [CODE_FIELD[code][0]]: CODE_FIELD[code][1] })
    if (code === 'VALIDATION_ERROR') {
      const field = API_FIELD[(error?.message ?? '').split(':')[0].split('.')[0]]
      if (field) return setErrors({ [field]: FIELD_HINT[field] })
    }
    setFormError(SERVER_MESSAGES[code] ?? error?.message ?? 'Something went wrong')
  }

  const input = 'mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100'
  const describe = (f: Field) => (errors[f] ? `${f}-error` : undefined)
  const err = (f: Field) => errors[f] && <p id={`${f}-error`} className="mt-1 text-sm text-red-700">{errors[f]}</p>
  const field = (id: string, label: string, control: ReactNode, f?: Field, hint?: ReactNode) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {control}
      {hint}
      {f && err(f)}
    </div>
  )
  const invalid = (f: Field) => ({ 'aria-invalid': !!errors[f], 'aria-describedby': describe(f) })

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">The car</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            {field('make', 'Make', (
              <select id="make" value={makeChoice} className={input} {...invalid('make')}
                onChange={(e) => { setMakeChoice(e.target.value); setModelChoice('') }}>
                <option value="">Choose…</option>
                {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value={OTHER}>Other…</option>
              </select>
            ), 'make')}
            {makeChoice === OTHER && field('make_other', 'Make name', (
              <input id="make_other" value={makeOther} maxLength={40} className={input} onChange={(e) => setMakeOther(e.target.value)} />
            ))}
          </div>
          <div className="space-y-2">
            {makeChoice !== OTHER && field('model', 'Model', (
              <select id="model" value={modelChoice} disabled={!makeIsListed} className={input} {...invalid('model')}
                onChange={(e) => setModelChoice(e.target.value)}>
                <option value="">{makeIsListed ? 'Choose…' : 'Choose a make first'}</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                {makeIsListed && <option value={OTHER}>Other…</option>}
              </select>
            ), 'model')}
            {(makeChoice === OTHER || modelChoice === OTHER) && field('model_other', 'Model name', (
              <input id="model_other" value={modelOther} maxLength={40} className={input} {...invalid('model')}
                onChange={(e) => setModelOther(e.target.value)} />
            ), makeChoice === OTHER ? 'model' : undefined)}
            {makeChoice === OTHER || modelChoice === OTHER ? (
              <p className="text-sm text-gray-600">Cars with a make or model we don’t list are checked by our team before going live.</p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field('year', 'Year', <input id="year" name="year" inputMode="numeric" maxLength={4} defaultValue={listing?.year ?? ''} className={input} {...invalid('year')} />, 'year')}
          {field('odometer_km', 'Odometer (km)', <input id="odometer_km" name="odometer_km" inputMode="numeric" defaultValue={listing?.odometer_km ?? ''} className={input} {...invalid('odometer_km')} />, 'odometer_km')}
          {field('price', 'Price (AUD)', (
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-gray-500">$</span>
              <input id="price" inputMode="decimal" value={price} className={`${input} pl-7`} {...invalid('price')}
                onChange={(e) => setPrice(e.target.value)} />
            </div>
          ), 'price')}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field('body_type', 'Body type', (
            <select id="body_type" name="body_type" defaultValue={listing?.body_type ?? ''} className={input} {...invalid('body_type')}>
              <option value="">Choose…</option>
              {BODY_TYPES.map((b) => <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>)}
            </select>
          ), 'body_type')}
          {field('transmission', 'Transmission', (
            <select id="transmission" name="transmission" defaultValue={listing?.transmission ?? ''} className={input} {...invalid('transmission')}>
              <option value="">Choose…</option>
              {TRANSMISSIONS.map((t) => <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>)}
            </select>
          ), 'transmission')}
          {field('fuel', 'Fuel', (
            <select id="fuel" name="fuel" defaultValue={listing?.fuel ?? ''} className={input} {...invalid('fuel')}>
              <option value="">Choose…</option>
              {FUELS.map((f) => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
            </select>
          ), 'fuel')}
        </div>
        {field('colour', 'Colour', <input id="colour" name="colour" maxLength={30} defaultValue={listing?.colour ?? ''} className={input} {...invalid('colour')} />, 'colour')}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Identification</legend>
        {field('vin', 'VIN', (
          <input id="vin" value={vin} maxLength={17} autoCapitalize="characters" spellCheck={false}
            className={`${input} font-mono tracking-wider`} {...invalid('vin')}
            onChange={(e) => setVin(e.target.value.toUpperCase())} />
        ), 'vin', <p className="mt-1 text-sm text-gray-600">17 characters, found on the compliance plate or rego papers. Shown to buyers so they can run a PPSR check.</p>)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('rego', 'Rego (optional)', <input id="rego" name="rego" maxLength={9} defaultValue={listing?.rego ?? ''} className={`${input} uppercase`} {...invalid('rego')} />, 'rego')}
          {field('rego_expiry', 'Rego expiry (optional)', <input id="rego_expiry" name="rego_expiry" type="date" defaultValue={listing?.rego_expiry ?? ''} className={input} {...invalid('rego_expiry')} />, 'rego_expiry')}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Description and location</legend>
        {field('description', 'Description', (
          <textarea id="description" rows={6} maxLength={DESCRIPTION_MAX} value={description} className={input}
            aria-describedby={['description-count', describe('description')].filter(Boolean).join(' ')}
            onChange={(e) => setDescription(e.target.value)} />
        ), 'description', <p id="description-count" className="mt-1 text-right text-sm text-gray-600">{description.length} / {DESCRIPTION_MAX}</p>)}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field('suburb', 'Suburb', <input id="suburb" name="suburb" maxLength={60} defaultValue={listing?.suburb ?? ''} className={input} {...invalid('suburb')} />, 'suburb')}
          {field('state', 'State', (
            <select id="state" name="state" defaultValue={listing?.state ?? ''} className={input} {...invalid('state')}>
              <option value="">Choose…</option>
              {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ), 'state')}
          {field('postcode', 'Postcode', <input id="postcode" name="postcode" inputMode="numeric" maxLength={4} defaultValue={listing?.postcode ?? ''} className={input} {...invalid('postcode')} />, 'postcode')}
        </div>
      </fieldset>

      {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Draft saved</p>}
      <button type="submit" disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60">
        {saving ? 'Saving…' : 'Save draft'}
      </button>
    </form>
  )
}
