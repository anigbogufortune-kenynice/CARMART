'use client'

import { useState } from 'react'
import { SETTING_DEFINITIONS, type SettingDefinition, type SettingKey, type Settings } from '@/services/settings.service'

/** Client-side mirror of settings.service validation, for instant feedback (the server re-checks). */
function problem(def: SettingDefinition, raw: string, all: Settings): string | null {
  if (raw.trim() === '') return 'Enter a value'
  const v = Number(raw)
  if (!Number.isFinite(v)) return 'Enter a number'
  if (def.kind === 'integer' && !Number.isInteger(v)) return 'Use a whole number'
  if (def.kind === 'fraction' && !(v > 0 && v <= 1)) return 'Must be above 0 and at most 1'
  if (def.kind === 'integer' && (v < def.min || v > def.max)) return `Must be between ${def.min} and ${def.max}`
  if (def.key === 'ai_review_threshold' && !(v < all.ai_reject_threshold)) return `must be below ai_reject_threshold (${all.ai_reject_threshold})`
  if (def.key === 'ai_reject_threshold' && !(v > all.ai_review_threshold)) return `must be above ai_review_threshold (${all.ai_review_threshold})`
  if (def.key === 'min_photos' && v > all.max_photos) return `must not be more than max_photos (${all.max_photos})`
  if (def.key === 'max_photos' && v < all.min_photos) return `must not be less than min_photos (${all.min_photos})`
  return null
}

function Row({ def, saved, all, onSaved }: { def: SettingDefinition; saved: number; all: Settings; onSaved: (k: SettingKey, v: number) => void }) {
  const [raw, setRaw] = useState(String(saved))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const id = `setting-${def.key}`
  const error = problem(def, raw, all)
  const changed = Number(raw) !== saved

  async function save() {
    setBusy(true)
    setServerError(null)
    setDone(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: def.key, value: Number(raw) }),
      })
      if (res.ok) {
        onSaved(def.key, Number(raw))
        setDone(true)
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: { message: string } }
        setServerError(j.error?.message ?? 'Couldn’t save')
      }
    } catch {
      setServerError('Couldn’t save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset aria-labelledby={`${id}-label`} className="grid gap-2 border-b border-gray-200 py-4 sm:grid-cols-[1fr_auto]">
      <div>
        <label id={`${id}-label`} htmlFor={id} className="font-medium">{def.label}</label>
        <p className="text-sm text-gray-600">{def.help}</p>
        <p className="font-mono text-xs text-gray-500">{def.key}</p>
      </div>
      <div className="flex items-start gap-2">
        <div>
          <input id={id} type="number" step={def.kind === 'fraction' ? 0.01 : 1} value={raw} aria-invalid={!!error}
            onChange={(e) => { setRaw(e.target.value); setDone(false) }} className="w-28 rounded border border-gray-300 px-2 py-1" />
          {error && changed && <p role="alert" className="mt-1 max-w-[16rem] text-xs text-red-700">{error}</p>}
          {serverError && <p role="alert" className="mt-1 max-w-[16rem] text-xs text-red-700">{serverError}</p>}
          {done && <p role="status" className="mt-1 text-xs text-green-800">Saved</p>}
        </div>
        <button type="button" onClick={() => void save()} disabled={busy || !changed || !!error}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-40">Save</button>
      </div>
    </fieldset>
  )
}

/** /admin/settings form: one row per setting, saved individually. */
export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial)
  const groups = Array.from(new Set(SETTING_DEFINITIONS.map((d) => d.group)))
  return (
    <div className="mt-6 space-y-8">
      {groups.map((g) => (
        <section key={g} aria-labelledby={`group-${g}`}>
          <h2 id={`group-${g}`} className="text-lg font-semibold">{g}</h2>
          {SETTING_DEFINITIONS.filter((d) => d.group === g).map((d) => (
            <Row key={d.key} def={d} saved={values[d.key]} all={values} onSaved={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
          ))}
        </section>
      ))}
    </div>
  )
}
