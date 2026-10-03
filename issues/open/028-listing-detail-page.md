# Issue 028: Public listing detail page (gallery, specs, VIN/PPSR, shop card, SOLD)

> **Nigeria (ADR-015):** no postcode (state + city only), prices in naira (kobo), +234 mobiles, Nigerian plate numbers instead of "rego", `pickup` instead of `ute`, a required car condition, no PPSR (VIN shown for buyers to check), Nigerian law for legal pages. Where this file says otherwise, ADR-015 wins.

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F02-listing-detail-page
**Type:** AFK
**Status:** open
**Blocked by:** #027
**Priority:** high
**Branch:** feature/028-listing-detail-page

## Goal
/cars/[id] shows everything a buyer needs to judge a car, including a PPSR link for the VIN.

## User Story
As a visitor, I want to see a car's photos and full details, so that I can decide whether to contact the seller.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/listings/:id (public view)
- docs/architecture.md: Page map (/cars/[id])

### System specs
- docs/systems/listing-lifecycle.md: sold visibility (7 days), INV-L3

## Acceptance Criteria
- [ ] Server-rendered page via search.service getListingForViewer; not visible → notFound()
- [ ] Gallery: the lg image with thumbnails (md/sm via `srcset`), keyboard navigable (←/→), alt text '<title> photo N of M'
- [ ] Spec table: price, year, km, body type, transmission, fuel, colour, rego + expiry (if any), location; VIN shown in monospace with 'Check this VIN on PPSR ↗' linking to https://www.ppsr.gov.au/ (rel noopener, new tab)
- [ ] A shop card with name, city/state, Verified badge, link to /shops/[slug]
- [ ] Sold listings (within 7 days) show a 'SOLD' banner, and the contact actions are hidden
- [ ] Placeholders (disabled) exist for Message seller / Save / Report until issues 029, 034 and 043 add them

## Files to Modify
- src/app/cars/[id]/page.tsx
- src/components/listing/PhotoGallery.tsx
- src/components/listing/SpecTable.tsx
- src/components/shop/ShopCard.tsx

**Test files (in scope):**
- src/components/listing/PhotoGallery.test.tsx
- src/components/listing/SpecTable.test.tsx
- src/app/cars/[id]/page.test.tsx

## Out of Scope
- SEO metadata (030)
- Messaging, saving, reporting (029, 034, 043)

## Implementation Plan

Step 1: PhotoGallery
Test 1: PhotoGallery.test.tsx → 5 photos: the main image shows photo 1; pressing ArrowRight shows photo 2; the thumbnail buttons have aria-labels 'Show photo 3 of 5'
File:   PhotoGallery.tsx

Step 2: SpecTable + PPSR
Test 2: SpecTable.test.tsx → renders 'Odometer 84,000 km', 'Price A$45,990', and the VIN link href 'https://www.ppsr.gov.au/' with target _blank and rel containing 'noopener'
File:   SpecTable.tsx

Step 3: ShopCard
Test 3: renders a link to /shops/coastal-cars and 'Verified shop' when verified
File:   ShopCard.tsx

Step 4: Page
Test 4: page.test.tsx → a live listing renders the title h1 '2019 Toyota HiLux SR5'; a sold one renders 'SOLD' and no contact buttons; the service returning NOT_FOUND → notFound() called
File:   src/app/cars/[id]/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test -- PhotoGallery SpecTable cars

### Manual verification
1. Open a seeded car from /cars → gallery, specs and the PPSR link work
2. Mark it sold (issue 024) → the SOLD banner shows, and there are no contact buttons
3. Open a draft's URL signed out → 404

## Git
- Branch: feature/028-listing-detail-page
- Commit: feat(search): add public listing detail page closes #028
- PR title: 028 Public listing detail page (gallery, specs, VIN/PPSR, shop card, SOLD)
