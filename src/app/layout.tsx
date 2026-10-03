import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { createServerSupabase } from '@/lib/supabase/server'
import './globals.css'

const geistSans = localFont({ src: './fonts/GeistVF.woff', variable: '--font-geist-sans', weight: '100 900' })
const geistMono = localFont({ src: './fonts/GeistMonoVF.woff', variable: '--font-geist-mono', weight: '100 900' })

export const metadata: Metadata = {
  title: { default: 'CarMart: cars for sale from verified Nigerian sellers', template: '%s' },
  description: 'Buy and sell cars in Nigeria. Every seller is verified and every photo is checked.',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser()

  return (
    <html lang="en-NG">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-gray-50 text-gray-900 antialiased`}>
        <SiteHeader user={user?.email ? { email: user.email } : null} />
        {children}
      </body>
    </html>
  )
}
