# Issue 021: Submit a listing and go live automatically

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F03-submit-and-go-live
**Type:** AFK
**Status:** open
**Blocked by:** #018, #020, #012
**Priority:** critical
**Branch:** feature/021-submit-listing-and-go-live

## Goal
An owner of an approved shop submits a complete listing; it goes live automatically when every photo passes, or shows why not.

## User Story
As a shop owner, I want my car to go live as soon as its photos pass, so that buyers see it quickly.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/listings/:id/submit
- docs/schema.md: listings (review_flags, live_at, expires_at, version)
- docs/decisions.md: ADR-011

### System specs
- docs/systems/listing-lifecycle.md: submit transition, Evaluate rules 1–4, INV-L1 to INV-L6, BR-L1, BR-L4 to BR-L8, BR-L10, BR-L11, EC-L11

## Acceptance Criteria
- [ ] `submit_listing(id, version)` validates: shop approved (422 SHOP_NOT_APPROVED), complete fields (422 LISTING_INCOMPLETE listing the missing fields), 4–20 photos (PHOTO_COUNT), active count < listing_cap (LISTING_LIMIT_REACHED), no own active listing with the same VIN (409 DUPLICATE_LISTING), version match (409 VERSION_CONFLICT)
- [ ] It adds `duplicate_vin` when another shop has the VIN checking/in_review/live, and `other_make_model` for 'Other'; queues checks for photos not yet passed; → checking; then calls evaluate_listing
- [ ] `evaluate_listing` implements rules 1–4 (replacing the placeholder from 018): all passed + no flags → live with live_at and expires_at = now + 60 d; any rejected → rejected; any in_review or flags → in_review
- [ ] The cap race: two concurrent submits for the last slot → exactly one succeeds
- [ ] /sell/listings/[id] shows 'Submit listing' (disabled with reasons when not ready) and a status banner: Checking…, Live since …, Rejected (per-photo reasons), In review (reason in plain words)

## Files to Modify
- supabase/migrations/20260928002100_submit_and_evaluate_listing.sql: `submit_listing`, `evaluate_listing` (create or replace)
- src/services/listing.service.ts: `submitListing`
- src/app/api/listings/[id]/submit/route.ts
- src/components/listing/ListingStatusBanner.tsx
- src/app/sell/listings/[id]/page.tsx: submit button + banner

**Test files (in scope):**
- tests/services/listing-submit.test.ts
- tests/services/evaluate-listing.test.ts
- src/components/listing/ListingStatusBanner.test.tsx

## Out of Scope
- Emails for these transitions (022)
- Editing live listings (023)
- Admin review actions (039–042)

## Implementation Plan

Step 1: Submit guards
Test 1: tests/services/listing-submit.test.ts → shop draft → SHOP_NOT_APPROVED; missing vin → LISTING_INCOMPLETE with message containing 'vin'; 3 photos → PHOTO_COUNT; shop with 10 active listings → LISTING_LIMIT_REACHED; stale version → VERSION_CONFLICT
File:   migration, listing.service.ts

Step 2: VIN + Other flags
Test 2: the same shop with an active listing for the VIN → DUPLICATE_LISTING; another shop's live listing with the VIN → submit ok, review_flags contains 'duplicate_vin'; make_other 'Holden-ish' → flags contain 'other_make_model'
File:   migration

Step 3: evaluate_listing rules
Test 3: tests/services/evaluate-listing.test.ts → 4 passed + no flags → live, live_at set, expires_at ≈ now + 60 d; 3 passed + 1 checking → unchanged (checking); 1 rejected → rejected with status_reason 'One or more photos were rejected'; 4 passed + flag duplicate_vin → in_review; calling evaluate twice → same result (idempotent)
File:   migration

Step 4: Cap race + route
Test 4: two parallel `submitListing` calls on different listings when the shop has 9 active → one ok, one LISTING_LIMIT_REACHED; POST /api/listings/:id/submit `{}` → 422 (version required)
File:   migration, route

Step 5: Banner + page
Test 5: ListingStatusBanner.test.tsx → status 'rejected' with 1 rejected photo renders 'Some photos were rejected' + the photo reason; 'in_review' with flag duplicate_vin renders 'We're checking this car's VIN — usually within a day'
File:   ListingStatusBanner.tsx, page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- submit transition guards exactly as in the transition table (lock the listing and shop rows FOR UPDATE)
- Evaluate rules 1–4, with the expires_at rule (set only if null or in the past)
- INV-L1 (one live per VIN), INV-L2 (≥ 4 passed when live), INV-L4 (flags ⇒ never live), INV-L5 (cap), INV-L6 (version++ on transitions)
- BR-L6 own duplicate → 409 DUPLICATE_LISTING; BR-L7 other shop → duplicate_vin flag; BR-L8 Other → other_make_model flag
- EC-L11: cap race → the second fails

**From docs/systems/image-verification.md:**
- The listing goes live only when every non-deleted photo is passed (never on error, INV-I5)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev (the shop must be approved: issue 012)

### Automated tests
npm run test && npm run test:integration -- listing-submit evaluate-listing

### Manual verification
1. Complete a HiLux draft with 4 passing fixture photos and click Submit → the banner shows Checking…, then Live within seconds
2. Submit another listing that includes dog.jpg → Rejected, with that photo's reason
3. Submit a listing with make 'Other' → In review

## Git
- Branch: feature/021-submit-listing-and-go-live
- Commit: feat(listings): add listing submission and automatic go-live evaluation closes #021
- PR title: 021 Submit a listing and go live automatically
