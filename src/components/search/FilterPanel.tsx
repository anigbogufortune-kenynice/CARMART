'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BODY_TYPES, BODY_TYPE_LABELS, CONDITIONS, CONDITION_LABELS, FUELS, FUEL_LABELS, NG_STATES, SEARCH_SORTS, TRANSMISSIONS,
  TRANSMISSION_LABELS, stateLabel,
} from '@/types/domain'

type Ref = { id: string; name: string }
type Current = Record<string, string>

/** Naira steps for the price selects; the URL carries kobo. */
const PRICES = [1_000_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000, 100_000_000]
const KMS = [10_000, 30_000, 50_000, 80_000, 100_000, 150_000, 200_000]
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 36 }, (_, i) => THIS_YEAR + 1 - i)
const SORT_LABELS: Record<(typeof SEARCH_SORTS)[number], string> = {
  newest: 'Newest first', price_asc: 'Price: low to high', price_desc: 'Price: high to low', km_asc: 'Lowest km', year_desc: 'Newest year',
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`
const field = 'mt-1 block w-full rounded-md border border-[#CBD3DF] bg-white px-3 py-2 text-[15px] text-[#1B2333] focus:border-[#14284B] focus:outline-none focus:ring-2 focus:ring-[#B8924F]/40 disabled:bg-[#F3F5F8]'
const labelCls = 'block text-[13px] font-medium text-[#5A6578]'

function toUrl(entries: [string, string][]): string {
  const qs = new URLSearchParams(entries.filter(([, v]) => v !== '')).toString()
  return qs ? `/cars?${qs}` : '/cars'
}

/** Sort select for the results header: keeps filters, resets the page. */
export function SortSelect({ current }: { current: Current }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-[#5A6578]">Sort by</label>
      <select id="sort" defaultValue={current.sort ?? 'newest'} className="rounded-md border border-[#CBD3DF] bg-white px-2 py-1.5 text-sm"
        onChange={(e) => {
          const rest = Object.entries(current).filter(([k]) => k !== 'sort' && k !== 'page')
          router.replace(toUrl([...rest, ['sort', e.target.value === 'newest' ? '' : e.target.value]]), { scroll: false })
        }}>
        {SEARCH_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
      </select>
    </div>
  )
}

/**
 * Search filters. Every change rewrites the URL (router.replace), and the server page re-renders the
 * results from it. The page number resets on any change; the sort is kept. Drawer on small screens.
 */
export function FilterPanel({ makes, current }: { makes: Ref[]; current: Current }) {
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [makeId, setMakeId] = useState(current.make_id ?? '')
  const [models, setModels] = useState<Ref[]>([])

  useEffect(() => {
    if (!makeId) { setModels([]); return }
    let live = true
    fetch(`/api/vehicle-makes/${makeId}/models`)
      .then((r) => r.json() as Promise<{ data?: Ref[] }>)
      .then((j) => { if (live) setModels(j.data ?? []) })
      .catch(() => { if (live) setModels([]) })
    return () => { live = false }
  }, [makeId])

  function apply() {
    if (!form.current) return
    const data = new FormData(form.current)
    const entries: [string, string][] = []
    if (current.sort) entries.push(['sort', current.sort])
    data.forEach((v, k) => entries.push([k, String(v).trim()]))
    router.replace(toUrl(entries), { scroll: false })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    apply()
    setOpen(false)
  }

  const select = (name: string, label: string, options: [string, string][], extra: { disabled?: boolean; onChange?: (v: string) => void } = {}) => (
    <div>
      <label htmlFor={`f-${name}`} className={labelCls}>{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={current[name] ?? ''} disabled={extra.disabled} className={field}
        onChange={(e) => { extra.onChange?.(e.target.value); apply() }}>
        <option value="">Any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="filters" onClick={() => setOpen((o) => !o)}
        className="w-full rounded-md border border-[#CBD3DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#14284B] lg:hidden">
        Filters
      </button>
      <div id="filters"
        className={`${open ? 'fixed inset-0 z-40 overflow-y-auto bg-white p-5' : 'hidden'} lg:static lg:block lg:p-0`}>
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2 className="text-lg font-semibold text-[#14284B]">Filters</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-[#14284B] underline">Done</button>
        </div>
        <form ref={form} onSubmit={onSubmit} aria-label="Filters" className="space-y-4">
          <div>
            <label htmlFor="f-make_id" className={labelCls}>Make</label>
            <select id="f-make_id" name="make_id" value={makeId} className={field}
              onChange={(e) => { setMakeId(e.target.value); const m = form.current?.elements.namedItem('model_id') as HTMLSelectElement | null; if (m) m.value = ''; queueMicrotask(apply) }}>
              <option value="">Any</option>
              {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-model_id" className={labelCls}>Model</label>
            <select id="f-model_id" name="model_id" defaultValue={current.model_id ?? ''} disabled={!makeId || models.length === 0}
              className={field} onChange={apply}>
              <option value="">Any</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {select('condition', 'Condition', CONDITIONS.map((c) => [c, CONDITION_LABELS[c]]))}
          <div className="grid grid-cols-2 gap-3">
            {select('price_min', 'Min price', PRICES.map((p) => [String(p * 100), naira(p)]))}
            {select('price_max', 'Max price', PRICES.map((p) => [String(p * 100), naira(p)]))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {select('year_min', 'From year', YEARS.map((y) => [String(y), String(y)]))}
            {select('year_max', 'To year', YEARS.map((y) => [String(y), String(y)]))}
          </div>
          {select('km_max', 'Max km', KMS.map((k) => [String(k), `${k.toLocaleString('en-NG')} km`]))}
          {select('body_type', 'Body type', BODY_TYPES.map((b) => [b, BODY_TYPE_LABELS[b]]))}
          {select('transmission', 'Transmission', TRANSMISSIONS.map((t) => [t, TRANSMISSION_LABELS[t]]))}
          {select('fuel', 'Fuel', FUELS.map((f) => [f, FUEL_LABELS[f]]))}
          {select('state', 'State', NG_STATES.map((s) => [s, stateLabel(s)]))}
          <div>
            <label htmlFor="f-city" className={labelCls}>City or area</label>
            <input id="f-city" name="city" defaultValue={current.city ?? ''} maxLength={60} placeholder="e.g. Ikeja" className={field}
              onBlur={(e) => { if (e.target.value.trim() !== (current.city ?? '')) apply() }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 rounded-md bg-[#14284B] px-4 py-2.5 text-sm font-semibold text-white lg:hidden">Show cars</button>
            <button type="button" className="flex-1 rounded-md border border-[#CBD3DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#14284B]"
              onClick={() => { form.current?.reset(); setMakeId(''); router.replace('/cars', { scroll: false }); setOpen(false) }}>
              Clear filters
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
