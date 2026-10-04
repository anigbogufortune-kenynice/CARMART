import type { Metadata, MetadataRoute } from 'next'
import { formatNaira } from './format'
import type { PublicPhoto } from '@/services/search.service'
import { CONDITION_LABELS, stateLabel, type NgState } from '@/types/domain'

/** Search-engine metadata, sitemap and robots rules (issue 030). Pure: callers pass the site URL. */

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const LEGAL_PATHS = ['/terms', '/privacy', '/prohibited-listings', '/buyer-safety', '/contact'] as const

type ListingMeta = {
  id: string; title: string; price_cents: number | null; odometer_km: number | null; city: string | null
  state: NgState | null; condition: string | null; photos: PublicPhoto[]
}

export function listingMetadata(l: ListingMeta, site: string): Metadata {
  const title = `${l.title} – ${formatNaira(l.price_cents)} | CarMart`
  const condition = l.condition && l.condition in CONDITION_LABELS ? CONDITION_LABELS[l.condition as keyof typeof CONDITION_LABELS] : null
  const place = [l.city, l.state ? stateLabel(l.state) : null].filter(Boolean).join(', ')
  const description = [
    `${l.title} for sale`,
    l.odometer_km != null ? `${l.odometer_km.toLocaleString('en-NG')} km` : null,
    condition, place ? `in ${place}` : null,
  ].filter(Boolean).join(', ') + '. Verified seller, checked photos.'
  const url = `${site}/cars/${l.id}`
  const image = l.photos[0]?.urls.lg
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'CarMart', images: image ? [{ url: image }] : undefined },
  }
}

export function shopMetadata(s: { name: string; city: string; slug: string }, site: string): Metadata {
  const title = `${s.name} – Verified car seller in ${s.city} | CarMart`
  const url = `${site}/shops/${s.slug}`
  return { title, description: `Cars for sale from ${s.name}, a verified seller in ${s.city}.`, alternates: { canonical: url }, openGraph: { title, url } }
}

export function buildSitemap(
  site: string, listings: { id: string; updated_at: string }[], shops: { slug: string; created_at: string }[],
): MetadataRoute.Sitemap {
  return [
    { url: site, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/cars`, changeFrequency: 'hourly', priority: 0.9 },
    ...LEGAL_PATHS.map((p) => ({ url: `${site}${p}`, changeFrequency: 'yearly' as const, priority: 0.2 })),
    ...listings.map((l) => ({ url: `${site}/cars/${l.id}`, lastModified: new Date(l.updated_at), priority: 0.7 })),
    ...shops.map((s) => ({ url: `${site}/shops/${s.slug}`, lastModified: new Date(s.created_at), priority: 0.5 })),
  ]
}

export function robotsRules(site: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/sell', '/account', '/admin', '/api'] },
    sitemap: `${site}/sitemap.xml`,
  }
}
