# Issue 014: Listings table, VIN rules and the draft API

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F01-create-listing-draft
**Type:** AFK
**Status:** open
**Blocked by:** #013, #007
**Priority:** high
**Branch:** feature/014-listings-table-and-draft-api

## Goal
Shop owners can create, update and delete listing drafts through the API, with every car field validated (VIN, AU postcode, car-only body types).

## User Story
As a shop owner, I want to save a car listing as a draft, so that I can finish it before submitting.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: listings (all columns, checks, indexes, RLS)
- docs/api-contracts.md: ListingInput (Zod), POST /api/listings, PATCH /api/listings/:id, DELETE /api/listings/:id
- docs/systems/listing-lifecycle.md: BR-L2, BR-L3, BR-L9

### System specs
- docs/systems/listing-lifecycle.md: create transition, BR-L2, BR-L3, BR-L9, BR-L10

## Acceptance Criteria
- [ ] Enums body_type (8 car values only), transmission_type, fuel_type, listing_status, review_flag exist
- [ ] POST /api/listings (partial input allowed) creates a `draft` for the caller's non-suspended shop; currency copied from the shop
- [ ] The VIN is normalised to uppercase; 'I', 'O', 'Q' or length ≠ 17 → 422 INVALID_VIN; body_type 'truck' → 422 VALIDATION_ERROR
- [ ] Exactly one of make_id/make_other (and model_id/model_other) when present; the postcode must match the state
- [ ] PATCH on a draft updates the fields and increments nothing (version changes only on transitions); DELETE works only on drafts (409 INVALID_STATE otherwise)
- [ ] Public/anon can't read drafts; owners read their own; the live-VIN partial unique index and the `search_vector` generated column exist

## Files to Modify
- supabase/migrations/20260928001400_listings.sql
- src/lib/vin.ts: `normaliseVin`, `isValidVin`
- src/types/domain.ts: BodyType/Transmission/Fuel schemas, VinSchema, ListingInputSchema
- src/services/listing.service.ts: `createDraft`, `updateDraft`, `deleteDraft`
- src/app/api/listings/route.ts: POST
- src/app/api/listings/[id]/route.ts: PATCH, DELETE

**Test files (in scope):**
- src/lib/vin.test.ts
- tests/services/listing-draft.test.ts
- tests/rls/listings.test.ts

## Out of Scope
- Submit and status transitions (021)
- Editing live listings (023)
- The listing form UI (015)

## Implementation Plan

Step 1: VIN helpers
Test 1: vin.test.ts → `normaliseVin(' jtfst22p900123456 ')` → 'JTFST22P900123456'; `isValidVin('JTFST22P900123456')` true; 'JTFST22P90012345' (16) false; 'JTFST22P9001234I6' (contains I) false
File:   src/lib/vin.ts

Step 2: Migration + RLS
Test 2: tests/rls/listings.test.ts → owner inserts a draft OK; another user's select → 0 rows; anon → 0 rows; inserting body_type 'truck' → invalid enum error; inserting two *live* rows with the same VIN via adminDb → unique violation on listings_live_vin_key; two *checking* rows with the same VIN → allowed
File:   migration

Step 3: ListingInputSchema
Test 3: full valid input parses; `{ make_id: <uuid>, make_other: 'X' }` → issue 'MAKE_REQUIRED'; year 2028 (current+2) fails; price_cents 50 fails
File:   src/types/domain.ts

Step 4: createDraft/updateDraft/deleteDraft
Test 4: tests/services/listing-draft.test.ts → `createDraft(asUser(owner), { vin: 'jtfst22p900123456' })` → ok with status 'draft', vin uppercase, currency 'AUD'; a user without a shop → SHOP_NOT_FOUND; `deleteDraft` on a listing forced to 'live' via adminDb → INVALID_STATE
File:   src/services/listing.service.ts

Step 5: Routes
Test 5: POST /api/listings `{ vin: 'BAD' }` → 422 INVALID_VIN; PATCH `{ postcode: '3000', state: 'NSW' }` → 422 POSTCODE_STATE_MISMATCH; DELETE a draft → 204
File:   src/app/api/listings/route.ts, src/app/api/listings/[id]/route.ts

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- BR-L2: VIN 17 chars, no I/O/Q, uppercase; no check-digit validation
- BR-L3: body type only from the car enum
- BR-L9: year/km/price/postcode ranges
- INV-L1 groundwork: unique index on vin WHERE status = 'live' (not checking/in_review)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- listing

### Manual verification
1. curl -X POST /api/listings with your session cookie and `{"vin":"jtfst22p900123456"}` → 201 draft with an uppercase VIN
2. The same with `{"body_type":"truck"}` → 422

## Git
- Branch: feature/014-listings-table-and-draft-api
- Commit: feat(listings): add listings table, VIN validation and draft API closes #014
- PR title: 014 Listings table, VIN rules and the draft API
