# Issue 027: /cars search page with filters, and the home page

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F01-search-and-filter
**Type:** AFK
**Status:** open
**Blocked by:** #026
**Priority:** high
**Branch:** feature/027-cars-search-page-and-home

## Goal
Visitors can browse /cars with a filter panel whose state lives in the URL, and the home page shows a search bar and the latest cars.

## User Story
As a visitor, I want an easy search page and a useful home page, so that I can start browsing right away.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/architecture.md: Page map (/, /cars)
- docs/api-contracts.md: GET /api/listings response

## Acceptance Criteria
- [ ] /cars is server-rendered from the URL query (calls searchListings directly); changing a filter updates the URL (router.replace) and results
- [ ] The filter panel: make → model (dependent), price range, year range, max km, body type, transmission, fuel, state, suburb/postcode; 'Clear filters'; on mobile it's a slide-over drawer
- [ ] Result cards: first photo (sm WebP, lazy, with alt '2019 Toyota HiLux'), title, price (A$45,990), km, suburb/state, 'Verified shop' badge
- [ ] Pagination (prev/next + page numbers) and a sort select; an empty state with a 'Clear filters' button
- [ ] The home page has a search bar (keyword + make + state) → /cars?..., the latest 12 live cars and a 'Sell your car' CTA → /sell

## Files to Modify
- src/app/cars/page.tsx
- src/components/search/FilterPanel.tsx
- src/components/search/ListingCard.tsx
- src/components/search/Pagination.tsx
- src/app/page.tsx
- src/app/shops/[slug]/page.tsx: show the shop's live listings with ListingCard

**Test files (in scope):**
- src/components/search/FilterPanel.test.tsx
- src/components/search/ListingCard.test.tsx
- src/components/search/Pagination.test.tsx

## Out of Scope
- Save/heart buttons (029)
- SEO metadata (030)

## Implementation Plan

Step 1: ListingCard
Test 1: ListingCard.test.tsx → given price_cents 4599000 it renders 'A$45,990'; the image alt is '2019 Toyota HiLux'; the Verified badge shows only when shop.verified
File:   ListingCard.tsx

Step 2: FilterPanel ↔ URL
Test 2: FilterPanel.test.tsx → selecting body type 'Ute' calls router.replace with '/cars?body_type=ute' (page param reset); 'Clear filters' → '/cars'; price inputs in dollars map to price_min cents
File:   FilterPanel.tsx

Step 3: Pagination
Test 3: Pagination.test.tsx → total 137, page 1 → 6 pages, 'Previous' disabled, the 'Next' link has ?page=2 preserving the other params
File:   Pagination.tsx

Step 4: /cars page
Test 4: render with searchParams `{ state: 'QLD' }` and the seeded data → heading '… cars for sale in QLD', 24 cards max; no results → the empty state
File:   src/app/cars/page.tsx

Step 5: Home + shop page listings
Test 5: the home page renders 12 latest cards and a search form whose submit goes to /cars?q=…; /shops/[slug] lists that shop's live cars
File:   src/app/page.tsx, src/app/shops/[slug]/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev (seeded sample listings from 026)

### Automated tests
npm run test -- search

### Manual verification
1. Open /cars, pick Toyota + QLD + Ute → the URL updates and the results match
2. Copy the URL into a new tab → the same results
3. Shrink to 360px → the filters open in a drawer
4. The home page shows 12 latest cars; searching 'hilux' goes to /cars?q=hilux

## Git
- Branch: feature/027-cars-search-page-and-home
- Commit: feat(search): add /cars search page with URL filters and home page closes #027
- PR title: 027 /cars search page with filters, and the home page
