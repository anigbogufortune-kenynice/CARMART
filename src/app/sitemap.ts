import type { MetadataRoute } from 'next'
import { buildSitemap, siteUrl } from '@/lib/seo'
import { createServerSupabase } from '@/lib/supabase/server'
import { sitemapEntries } from '@/services/search.service'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings, shops } = await sitemapEntries(createServerSupabase())
  return buildSitemap(siteUrl(), listings, shops)
}
