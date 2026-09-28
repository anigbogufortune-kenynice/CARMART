# Issue 024: Mark a listing sold, and unpublish removed or old sold listings

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F04-manage-live-listings
**Type:** AFK
**Status:** open
**Blocked by:** #023
**Priority:** normal
**Branch:** feature/024-mark-sold-and-unpublish

## Goal
Owners mark cars sold; sold cars show a SOLD state by URL for 7 days, then disappear, and public photo files are cleaned up.

## User Story
As a shop owner, I want to mark my car sold, so that buyers stop contacting me about it.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/listings/:id/mark-sold, Internal: unpublish-listing
- docs/schema.md: listings RLS (sold < 7 d), Scheduled jobs (unpublish_old_sold)

### System specs
- docs/systems/listing-lifecycle.md: mark_sold transition, Computed values (sold visibility), Implementation Notes (unpublishing)

## Acceptance Criteria
- [ ] `mark_listing_sold(id, version)` live → sold with sold_at; other states → 409 INVALID_STATE
- [ ] Sold listings leave search immediately, stay readable by URL for sold_visible_days, then 404
- [ ] An AFTER UPDATE trigger on listings → removed calls /api/internal/unpublish-listing via pg_net; the daily `unpublish_old_sold()` does the same for sold listings past 7 days
- [ ] unpublish-listing deletes all public variants for the listing and nulls public_paths (idempotent)
- [ ] The seller page has 'Mark as sold' with confirmation; a sold listing shows 'Sold on <date>'

## Files to Modify
- supabase/migrations/20260928002400_sold_and_unpublish.sql
- src/services/listing.service.ts: `markSold`
- src/app/api/listings/[id]/mark-sold/route.ts
- src/server/jobs/image-verification/unpublish.ts: `unpublishListing`
- src/app/api/internal/unpublish-listing/route.ts
- src/app/sell/listings/[id]/page.tsx: Mark as sold

**Test files (in scope):**
- tests/services/listing-sold.test.ts
- tests/jobs/unpublish.test.ts

## Out of Scope
- Admin removal UI (042), which only relies on the trigger added here

## Implementation Plan

Step 1: mark_listing_sold
Test 1: tests/services/listing-sold.test.ts → live → sold, sold_at set, version+1; draft → INVALID_STATE
File:   migration, listing.service.ts, route

Step 2: Sold visibility
Test 2: anon view of a sold listing with sold_at = now → ok with status 'sold'; with sold_at = now − 8 days → NOT_FOUND
File:   migration (RLS already in 014; verify)

Step 3: unpublishListing
Test 3: tests/jobs/unpublish.test.ts → for a listing with 4 published photos, `unpublishListing(id)` deletes 12 objects, sets public_paths null; a second run → deleted 0
File:   unpublish.ts, internal route

Step 4: Triggers/cron
Test 4: setting status 'removed' via adminDb enqueues a net.http_request_queue row for /api/internal/unpublish-listing; `select unpublish_old_sold()` with one 8-day-old sold listing enqueues exactly 1 request
File:   migration

Step 5: Seller UI
Test 5: clicking 'Mark as sold' → confirm → POST mark-sold with version; the banner shows 'Sold on 28 Sep 2026'
File:   src/app/sell/listings/[id]/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- live --mark_sold--> sold only; every other state → INVALID_STATE
- Sold public visibility = sold_at > now() − sold_visible_days (RLS)
- Unpublishing on removed + after the sold window, via pg_net to the internal route (idempotent)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- listing-sold unpublish

### Manual verification
1. Mark a live listing sold → the URL still loads with SOLD, and it's gone from the seller's Live filter
2. In SQL set sold_at to 8 days ago and run `select unpublish_old_sold();` → within a minute the public photo URLs return 404

## Git
- Branch: feature/024-mark-sold-and-unpublish
- Commit: feat(listings): add mark-as-sold and public photo unpublishing closes #024
- PR title: 024 Mark a listing sold, and unpublish removed or old sold listings
