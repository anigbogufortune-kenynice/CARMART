# Issue 030: SEO metadata, sitemap, robots and site footer

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F04-seo-a11y-legal
**Type:** AFK
**Status:** open
**Blocked by:** #029
**Priority:** normal
**Branch:** feature/030-seo-metadata-footer

## Goal
Every public page is shareable and indexable, and the site has a consistent footer.

## User Story
As CarMart, I want Google and social apps to show our cars properly, so that buyers find us.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/architecture.md: Page map (sitemap, robots)
- docs/env.md: NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPPORT_EMAIL

## Acceptance Criteria
- [ ] /cars/[id] `generateMetadata`: title '2019 Toyota HiLux SR5 – A$45,990 | CarMart', a description (km, location), OG image = the first photo's lg URL, canonical `${SITE_URL}/cars/<id>`; a non-visible listing → notFound
- [ ] /shops/[slug] metadata: '<Shop name> – Verified car seller in <Suburb> | CarMart'
- [ ] Root layout: default title template, description, `metadataBase` = NEXT_PUBLIC_SITE_URL, the SiteFooter
- [ ] sitemap.xml lists /, /cars, the legal pages, every live listing and approved shop (lastModified = updated_at); robots.txt allows / and disallows /sell, /account, /admin, /api
- [ ] SiteFooter links: Terms, Privacy, Prohibited Listings, Buyer Safety, Contact; shows © CarMart

## Files to Modify
- src/app/sitemap.ts
- src/app/robots.ts
- src/app/cars/[id]/page.tsx: generateMetadata
- src/app/shops/[slug]/page.tsx: generateMetadata
- src/app/layout.tsx
- src/components/layout/SiteFooter.tsx

**Test files (in scope):**
- src/app/sitemap.test.ts
- src/app/robots.test.ts
- src/app/cars/[id]/metadata.test.ts

## Out of Scope
- The legal page content (031)

## Implementation Plan

Step 1: robots
Test 1: robots.test.ts → rules disallow ['/sell','/account','/admin','/api'], and sitemap = `${SITE_URL}/sitemap.xml`
File:   src/app/robots.ts

Step 2: sitemap
Test 2: sitemap.test.ts (service stubbed at the DB boundary with 2 live listings + 1 approved shop) → includes `${SITE_URL}/cars/<id>` ×2, `/shops/coastal-cars`, `/terms`; excludes drafts
File:   src/app/sitemap.ts

Step 3: Listing metadata
Test 3: metadata.test.ts → title '2019 Toyota HiLux SR5 – A$45,990 | CarMart', openGraph.images[0].url ends with '-lg.webp', alternates.canonical correct
File:   src/app/cars/[id]/page.tsx

Step 4: Shop metadata + layout + footer
Test 4: the shop title includes 'Verified car seller in Parramatta'; the footer renders 5 legal links
File:   src/app/shops/[slug]/page.tsx, src/app/layout.tsx, SiteFooter.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test -- sitemap robots metadata

### Manual verification
1. Open /sitemap.xml → the live cars and shops are listed
2. View the source of a car page → og:image and the canonical tags are present
3. The footer shows on every page

## Git
- Branch: feature/030-seo-metadata-footer
- Commit: feat(seo): add SEO metadata, sitemap, robots and site footer closes #030
- PR title: 030 SEO metadata, sitemap, robots and site footer
