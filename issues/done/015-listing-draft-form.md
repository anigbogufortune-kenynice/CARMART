# Issue 015: Seller listings dashboard and the car listing form

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F01-create-listing-draft
**Type:** AFK
**Status:** open
**Blocked by:** #014, #008
**Priority:** high
**Branch:** feature/015-listing-draft-form

## Goal
In /sell/listings the owner sees their listings, creates a new car listing through a structured form, and edits drafts.

## User Story
As a shop owner, I want a clear form for my car's details, so that listing is quick and accurate.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/shops/me/listings, POST/PATCH /api/listings
- docs/architecture.md: Page map (/sell/listings…)
- docs/systems/listing-lifecycle.md: Computed values (title)

## Acceptance Criteria
- [ ] /sell/listings lists the owner's listings (title, price, status chip, updated) with a 'New listing' button; empty state 'No cars listed yet'
- [ ] /sell/listings/new → the ListingForm: make select → dependent model select (loaded from the API), each with an 'Other…' option revealing a text field; year, km, price (AUD, entered in dollars and sent as cents), body type, transmission, fuel, colour, VIN (auto-uppercase), rego + expiry (optional), description (5000 counter), state/suburb/postcode
- [ ] Server validation errors map to the matching field
- [ ] Save draft → redirect to /sell/listings/[id] showing the form in edit mode
- [ ] The form is keyboard accessible, and every input has a label

## Files to Modify
- src/services/listing.service.ts: `listMine`
- src/app/api/shops/me/listings/route.ts
- src/app/sell/listings/page.tsx
- src/app/sell/listings/new/page.tsx
- src/app/sell/listings/[id]/page.tsx
- src/components/listing/ListingForm.tsx: includes the dependent make/model select (internal component)
- src/app/sell/listings/new/NewListing.tsx, src/app/sell/listings/[id]/EditListing.tsx: client wrappers (navigation/state) for the server pages
- src/lib/api/route-helpers.ts: `paginated` option → `{ data: items, page }`; src/types/result.ts: `Page<T>`
- src/types/domain.ts: display labels for body type, transmission, fuel, status

**Test files (in scope):**
- src/components/listing/ListingForm.test.tsx
- tests/services/listing-mine.test.ts
- e2e/listing-form.spec.ts (Step 4 page checks)

## Out of Scope
- Photos (016/020)
- Submit (021)

## Implementation Plan

Step 1: GET /api/shops/me/listings (+ `listMine` in listing.service)
Test 1: tests/services/listing-mine.test.ts → owner with 2 drafts → 2 items with `title` '2019 Toyota HiLux' computed; `?status=live` → 0
File:   src/services/listing.service.ts, src/app/api/shops/me/listings/route.ts

Step 2: Make/model select inside ListingForm
Test 2: ListingForm.test.tsx → choosing make 'Toyota' fetches `/api/vehicle-makes/<id>/models` and enables the model select; choosing 'Other…' shows a text input and sets make_id null
File:   src/components/listing/ListingForm.tsx

Step 3: ListingForm
Test 3: ListingForm.test.tsx → entering price '45,990' submits price_cents 4599000; VIN 'jtf…' displays uppercase; a server 422 INVALID_VIN puts 'Enter a valid 17-character VIN' under the VIN field
File:   src/components/listing/ListingForm.tsx

Step 4: Pages
Test 4: /sell/listings renders the empty state with no listings; /sell/listings/new saving calls POST then navigates to /sell/listings/<id>
File:   src/app/sell/listings/page.tsx, new/page.tsx, [id]/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- listing-mine

### Manual verification
1. Open /sell/listings → 'No cars listed yet'
2. Create a 2019 Toyota HiLux draft, entering price 45,990 → it appears in the list as Draft at $45,990
3. Type a VIN with an 'O' → the VIN error shows

## Git
- Branch: feature/015-listing-draft-form
- Commit: feat(listings): add seller listings dashboard and car listing form closes #015
- PR title: 015 Seller listings dashboard and the car listing form
