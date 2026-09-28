import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata: Metadata = { title: 'Sign in | CarMart' }

const NOTICES: Record<string, string> = {
  link_invalid: 'That link has expired or was already used. Sign in, or request a new link.',
}

export default function SignInPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign in to CarMart</h1>
      <AuthForm next={searchParams.next} notice={searchParams.error ? NOTICES[searchParams.error] : undefined} />
    </main>
  )
}
