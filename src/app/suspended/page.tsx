import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account suspended | CarMart' }

export default function SuspendedPage() {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@carmart.example'
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Your account is suspended</h1>
      <p className="mt-3 text-gray-700">
        You can still browse cars, but you can&apos;t sell, message or manage your account while it&apos;s suspended.
      </p>
      <p className="mt-3 text-gray-700">
        If you think this is a mistake, email <a className="underline" href={`mailto:${support}`}>{support}</a>.
      </p>
    </main>
  )
}
