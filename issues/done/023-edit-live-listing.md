# Issue 023: Edit a live listing (minor vs identity changes, live photo rules)

> **Nigeria (ADR-015):** no postcode (state + city only), prices in naira (kobo), +234 mobiles, Nigerian plate numbers instead of "rego", `pickup` instead of `ute`, a required car condition, no PPSR (VIN shown for buyers to check), Nigerian law for legal pages. Where this file says otherwise, ADR-015 wins.

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F04-manage-live-listings
**Type:** AFK
**Status:** open
**Blocked by:** #022
**Priority:** high
**Branch:** feature/023-edit-live-listing

## Goal
Owners can keep live listings accurate: price and text edits apply instantly, identity changes re-check the car, and photo changes never expose unchecked photos.

## User Story
As a shop owner, I want to update my live listing without taking it down unnecessarily.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: PATCH /api/listings/:id (edit rules), DELETE photo on live
- docs/schema.md: listings.version

### System specs
- docs/systems/listing-lifecycle.md: transitions edit_minor, edit_identity, add_photo; EC-L1 to EC-L4; BR-L10
- docs/systems/image-verification.md: photos on live listings (Evaluate rules, live section)

## Acceptance Criteria
- [x] PATCH on live with only minor fields (colour, rego, rego_expiry, description, price_cents, odometer_km, city, postcode, state) keeps it live, and the change is visible publicly at once
- [x] PATCH changing vin/make/model/year on live → `update_listing_identity` RPC → checking (leaves public view), the duplicate-VIN check re-runs, version++
- [x] PATCH on checking/in_review/sold/removed → 409 INVALID_STATE; a stale version → 409 VERSION_CONFLICT
- [x] Adding a photo to a live listing keeps the listing live; the new photo is hidden until passed; deleting a photo that would leave < 4 passed → 422 PHOTO_COUNT
- [x] The ListingForm in live mode shows a notice: 'Changing VIN, make, model or year will re-check your listing'

## Files to Modify
- supabase/migrations/20260928002300_live_edits.sql: `update_listing_identity`, and allow evaluate for live photo additions
- src/services/listing.service.ts: `updateListing` (replaces updateDraft usage; applies the edit rules)
- src/app/api/listings/[id]/route.ts: PATCH uses updateListing
- src/services/image-upload.service.ts: live-listing delete rule
- src/components/listing/ListingForm.tsx: live mode notice

**Test files (in scope):**
- tests/services/listing-edit.test.ts

## Out of Scope
- Mark sold / renew (024, 025)

## Implementation Plan

Step 1: Minor edit on live
Test 1: tests/services/listing-edit.test.ts → `updateListing(db, id, { price_cents: 4299000, version })` on live → ok, status live; the anon view shows the new price
File:   listing.service.ts

Step 2: Identity edit on live
Test 2: `updateListing(db, id, { year: 2020, version })` → status checking, version+1, and the anon view → NOT_FOUND; after evaluate (photos still passed) → live again with the same expires_at
File:   migration, listing.service.ts

Step 3: Blocked states + version
Test 3: status checking → INVALID_STATE; a stale version → VERSION_CONFLICT
File:   listing.service.ts, route

Step 4: Live photo rules
Test 4: adding a photo on live: the listing stays live and the anon view has 4 photos until the new one passes (then 5); deleting a passed photo when exactly 4 remain → PHOTO_COUNT
File:   image-upload.service.ts, migration

Step 5: Form notice
Test 5: ListingForm in live mode renders the re-check notice text
File:   ListingForm.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- edit_minor fields list exactly as in the transition table
- edit_identity → checking, re-run the duplicate-VIN check, keep expires_at
- EC-L1 optimistic lock, EC-L2 no edits while checking, EC-L3 min 4 passed on live, EC-L4 an identity edit creating a VIN clash → in_review

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- listing-edit

### Manual verification
1. On a live listing change the price → still Live, and /api/listings/<id> shows the new price
2. Change the year → Checking, then Live again
3. Try to delete a photo leaving 3 → an error message

## Git
- Branch: feature/023-edit-live-listing
- Commit: feat(listings): add live listing edit rules closes #023
- PR title: 023 Edit a live listing (minor vs identity changes, live photo rules)
