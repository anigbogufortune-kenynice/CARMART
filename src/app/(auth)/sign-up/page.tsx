'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { createBrowserSupabase } from '@/lib/supabase/client'

const SignUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name').max(60, 'Name must be 60 characters or fewer'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
})

type Field = keyof z.infer<typeof SignUpSchema>
type FieldErrors = Partial<Record<Field, string>>

function friendly(message: string): string {
  if (/already registered/i.test(message)) return 'An account with this email already exists'
  if (/rate limit/i.test(message)) return 'Too many attempts — please wait a minute and try again'
  return 'Something went wrong creating your account. Please try again.'
}

export default function SignUpPage() {
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const form = new FormData(event.currentTarget)
    const parsed = SignUpSchema.safeParse({
      displayName: form.get('displayName'),
      email: form.get('email'),
      password: form.get('password'),
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    setBusy(true)
    const { error } = await createBrowserSupabase().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })
    setBusy(false)
    if (error) setFormError(friendly(error.message))
    else setSent(true)
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Check your email to verify your account</h1>
        <p className="mt-3 text-gray-700">
          We&apos;ve sent you a link. Open it on this device to finish creating your CarMart account.
        </p>
      </main>
    )
  }

  const field = (name: Field, label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
      />
      {errors[name] && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {errors[name]}
        </p>
      )}
    </div>
  )

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Create your CarMart account</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {field('displayName', 'Display name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60">
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </main>
  )
}
