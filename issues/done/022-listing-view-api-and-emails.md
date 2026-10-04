# Issue 022: Listing detail API (public vs owner) and listing status emails

> **Nigeria (ADR-015):** no postcode (state + city only), prices in naira (kobo), +234 mobiles, Nigerian plate numbers instead of "rego", `pickup` instead of `ute`, a required car condition, no PPSR (VIN shown for buyers to check), Nigerian law for legal pages. Where this file says otherwise, ADR-015 wins.

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F03-submit-and-go-live
**Type:** AFK
**Status:** open
**Blocked by:** #021
**Priority:** high
**Branch:** feature/022-listing-view-api-and-emails

## Goal
GET /api/listings/:id returns the right view for the public, the owner and admins, and sellers are emailed when a listing goes live, is rejected or goes to review.

## User Story
As a shop owner, I want to be told when my car is live or needs attention; as a buyer, I want accurate listing data.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/listings/:id
- docs/schema.md: listings RLS (public live, sold < 7 d), notifications kinds
- docs/decisions.md: ADR-010

### System specs
- docs/systems/listing-lifecycle.md: Evaluate rules (enqueue listing_live / listing_rejected / listing_in_review), INV-L3, Computed values (title)

## Acceptance Criteria
- [ ] Public: live (and sold < 7 days) listings of approved shops only → 200 with ordered photo URLs sm/md/lg, title, specs, VIN, ppsr_url, shop summary; anything else → 404
- [ ] Owner/admin: any status, plus per-photo status/reason, status_reason and review_flags as seller-facing text
- [ ] The evaluate transitions enqueue listing_live, listing_rejected (with per-photo reasons) and listing_in_review (first entry only) in the same transaction
- [ ] Email templates exist for these three kinds, with links to /sell/listings/[id] (and /cars/[id] for live)

## Files to Modify
- supabase/migrations/20260928002200_listing_notifications.sql: `evaluate_listing` (create or replace, adds the enqueue calls)
- src/services/search.service.ts: `getListingForViewer` (file created here)
- src/app/api/listings/[id]/route.ts: add GET
- src/server/jobs/notification-dispatch/templates.ts: listing_live, listing_rejected, listing_in_review

**Test files (in scope):**
- tests/services/listing-view.test.ts
- tests/services/listing-emails.test.ts
- src/server/jobs/notification-dispatch/templates.test.ts

## Out of Scope
- The public page UI (028)
- Search (026)

## Implementation Plan

Step 1: getListingForViewer public
Test 1: tests/services/listing-view.test.ts → anon on a live listing of an approved shop → ok with photos ordered by position (only passed), `ppsr_url: 'https://www.ppsr.gov.au/'`, no review_flags field; anon on a checking listing → NOT_FOUND; live listing but shop suspended → NOT_FOUND
File:   src/services/search.service.ts

Step 2: Owner/admin view
Test 2: owner on a rejected listing → ok with photos including the rejected one and its status_reason; admin → ok for any listing
File:   src/services/search.service.ts

Step 3: Enqueue on evaluate
Test 3: tests/services/listing-emails.test.ts → driving a listing to live creates 1 pending listing_live notification for the owner; to rejected → 1 listing_rejected with payload.photos[] reasons; entering in_review twice (e.g. after a flag change) → only 1 listing_in_review
File:   migration

Step 4: Templates
Test 4: templates.test.ts → `render('listing_live', { title: '2019 Toyota HiLux', listingId: 'x' })` subject contains 'is live' and the text contains `${SITE_URL}/cars/x`
File:   templates.ts

Step 5: GET route
Test 5: GET /api/listings/<draft id> as anon → 404; as owner → 200 with status 'draft'
File:   src/app/api/listings/[id]/route.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- listing-view listing-emails

### Manual verification
1. After a listing goes live, the dev log shows the 'Your 2019 Toyota HiLux is live' email
2. curl /api/listings/<id> signed out → public JSON; for a draft → 404

## Git
- Branch: feature/022-listing-view-api-and-emails
- Commit: feat(listings): add listing detail API views and listing status emails closes #022
- PR title: 022 Listing detail API (public vs owner) and listing status emails
