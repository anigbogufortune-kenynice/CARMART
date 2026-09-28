# Issue 042: Clear review flags, reject or remove listings

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F02-listing-review-and-removal
**Type:** AFK
**Status:** open
**Blocked by:** #041
**Priority:** high
**Branch:** feature/042-admin-listing-actions

## Goal
Admins resolve held listings (clear a flag, reject with a reason) and can remove any listing, which unpublishes it and tells the seller.

## User Story
As an admin, I want to resolve reviews and take down bad listings, with the seller told why.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/admin/listings/:id/clear-flag|reject|remove
- docs/schema.md: listings.review_flags, admin_actions

### System specs
- docs/systems/listing-lifecycle.md: transitions admin_clear_flag, admin_reject, admin_remove; INV-L1, INV-L7; EC-L8

## Acceptance Criteria
- [ ] clear-flag `{ flag }` removes one flag (duplicate_vin / other_make_model / reports_threshold / image_review) and runs evaluate_listing; clearing duplicate_vin while another listing with that VIN is live → 409 VIN_STILL_LIVE
- [ ] reject `{ reason }` in_review → rejected, clears the flags, enqueues listing_rejected
- [ ] remove `{ reason }` from any state except removed → removed (terminal): the trigger unpublishes photos (from 024), enqueues listing_removed; removing an already removed listing → 409 INVALID_STATE
- [ ] Every action writes admin_actions; a reason is required for reject/remove (422 REASON_REQUIRED)
- [ ] The review pages get Clear flag / Reject buttons; the listing detail page (admins only) gets 'Remove listing'

## Files to Modify
- supabase/migrations/20260928004200_admin_listing_actions.sql
- src/services/moderation.service.ts: `decideListing`
- src/app/api/admin/listings/[id]/[action]/route.ts
- src/server/jobs/notification-dispatch/templates.ts: listing_removed
- src/components/admin/RemoveListingDialog.tsx
- src/app/admin/duplicate-vins/page.tsx: actions

**Test files (in scope):**
- tests/services/moderation-listing-actions.test.ts

## Out of Scope
- Admin remove button placement on the other-make-model page (reuses the same dialog; the page edit is part of 044's scope if needed)

## Implementation Plan

Step 1: clear-flag + VIN guard
Test 1: tests/services/moderation-listing-actions.test.ts → B flagged duplicate_vin with A live → clear → VIN_STILL_LIVE; remove A, then clear B → B's flags [] and after evaluate → live
File:   migration, moderation.service.ts

Step 2: reject
Test 2: reject B with 'VIN belongs to another car' → rejected, status_reason set, 1 listing_rejected notification
File:   migration

Step 3: remove
Test 3: remove a live listing → removed, status_reason set, a net.http_request_queue row for unpublish-listing, a listing_removed notification; remove again → INVALID_STATE
File:   migration, templates.ts

Step 4: Route + UI
Test 4: POST remove `{}` → 422 REASON_REQUIRED; RemoveListingDialog requires ≥ 5 chars
File:   route, RemoveListingDialog.tsx, duplicate-vins page

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- admin_clear_flag must refuse duplicate_vin while another listing with that VIN is live (EC-L8, INV-L1)
- admin_remove from any non-removed state; removed is terminal (INV-L7)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-listing-actions

### Manual verification
1. Resolve the duplicate pair: remove the older fake one, clear the flag on the other → it goes live
2. Remove any live listing → the seller gets an email with the reason, and its photos 404 within a minute

## Git
- Branch: feature/042-admin-listing-actions
- Commit: feat(admin): add admin listing flag clearing, rejection and removal closes #042
- PR title: 042 Clear review flags, reject or remove listings
