# Issue 029: Saved cars (watchlist)

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F03-saved-cars
**Type:** AFK
**Status:** open
**Blocked by:** #028
**Priority:** normal
**Branch:** feature/029-saved-cars

## Goal
Signed-in buyers can save cars from the listing page and manage them on /account/saved.

## User Story
As a buyer, I want to save cars I like, so that I can compare them later.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: saved_listings
- docs/api-contracts.md: Saved listings

## Acceptance Criteria
- [ ] `saved_listings` with RLS (own rows only)
- [ ] POST /api/saved-listings is idempotent (201 new / 200 existing); only publicly visible listings can be saved (404 otherwise); DELETE → 204
- [ ] GET returns saved cars newest first, and ones no longer visible are flagged `unavailable: true`
- [ ] A heart 'Save' toggle on /cars/[id] (visitors are sent to /sign-in?next=…); /account/saved lists the cars, with a 'No longer available' state

## Files to Modify
- supabase/migrations/20260928002900_saved_listings.sql
- src/app/api/saved-listings/route.ts: GET, POST
- src/app/api/saved-listings/[listingId]/route.ts: DELETE
- src/components/listing/SaveButton.tsx
- src/app/account/saved/page.tsx
- src/app/cars/[id]/page.tsx: add SaveButton

**Test files (in scope):**
- tests/services/saved-listings.test.ts
- src/components/listing/SaveButton.test.tsx

## Out of Scope
- Hearts on search result cards (a later enhancement)

## Implementation Plan

Step 1: Table + RLS
Test 1: tests/services/saved-listings.test.ts → a user can't select another user's saved rows; anon can't insert
File:   migration

Step 2: POST idempotent + visibility
Test 2: saving the same live listing twice → 201 then 200, 1 row; saving a draft → 404
File:   route

Step 3: GET with unavailable
Test 3: save a live listing, then mark it sold 8 days ago → GET returns it with `unavailable: true`
File:   route (query joins public visibility)

Step 4: SaveButton
Test 4: SaveButton.test.tsx → signed out, clicking navigates to /sign-in?next=%2Fcars%2F<id>; signed in, clicking toggles aria-pressed and calls POST then DELETE
File:   SaveButton.tsx, src/app/cars/[id]/page.tsx

Step 5: /account/saved
Test 5: renders the saved cards; an unavailable one shows 'No longer available' and a Remove button
File:   src/app/account/saved/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- saved-listings

### Manual verification
1. Signed in, save 2 cars from their pages → /account/saved shows both
2. Signed out, click Save → you're redirected to sign in, then back to the car

## Git
- Branch: feature/029-saved-cars
- Commit: feat(saved): add saved cars watchlist closes #029
- PR title: 029 Saved cars (watchlist)
