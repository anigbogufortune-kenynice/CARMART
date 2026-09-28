# Issue 041: Duplicate-VIN and 'Other' make/model review queues

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F02-listing-review-and-removal
**Type:** AFK
**Status:** open
**Blocked by:** #040
**Priority:** normal
**Branch:** feature/041-admin-listing-review-queues

## Goal
Admins can see listings held for a duplicate VIN (next to the listing already using that VIN) and listings with an 'Other' make or model.

## User Story
As an admin, I want to compare duplicate-VIN listings side by side, so that I can spot stolen-photo scams.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/admin/queues/duplicate-vins, other-make-model
- CLAUDE.md: deep modules (moderation.service public API is capped at 8 exports: listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension, setListingCap, listAuditLog)

### System specs
- docs/systems/listing-lifecycle.md: BR-L7, BR-L8, Alternative path (duplicate VIN)

## Acceptance Criteria
- [ ] `listQueue('duplicate-vins')` returns in_review listings with the flag duplicate_vin, each paired with every other listing using the same VIN (checking/in_review/live), both with title, shop, status, first photo (signed or public URL), submitted/live dates
- [ ] `listQueue('other-make-model')` returns in_review listings flagged other_make_model, with make_other/model_other text
- [ ] /admin/duplicate-vins shows pairs side by side; /admin/other-make-model lists the entries; both are linked from the admin nav with counts

## Files to Modify
- src/services/moderation.service.ts: `listQueue` duplicate-vins + other-make-model branches
- src/app/api/admin/queues/[queue]/route.ts
- src/app/admin/duplicate-vins/page.tsx
- src/app/admin/other-make-model/page.tsx
- src/app/admin/layout.tsx: nav + counts

**Test files (in scope):**
- tests/services/moderation-listing-queues.test.ts

## Out of Scope
- Actions (042)

## Implementation Plan

Step 1: Duplicate-VIN queue
Test 1: tests/services/moderation-listing-queues.test.ts → shop A live with VIN V, shop B submits V → the queue item is B with `others: [A]`, and A's photo URL is public
File:   moderation.service.ts

Step 2: Other make/model queue
Test 2: a listing with make_other 'Holden-ish' → the queue item shows the make text 'Holden-ish'
File:   moderation.service.ts

Step 3: Pages + nav
Test 3: /admin/duplicate-vins renders two columns with both titles; the nav shows 'Duplicate VINs (1)'
File:   pages, layout

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-listing-queues

### Manual verification
1. Create two listings with the same VIN from two shops → /admin/duplicate-vins shows them side by side

## Git
- Branch: feature/041-admin-listing-review-queues
- Commit: feat(admin): add duplicate-VIN and other make/model review queues closes #041
- PR title: 041 Duplicate-VIN and 'Other' make/model review queues
