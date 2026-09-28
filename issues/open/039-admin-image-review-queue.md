# Issue 039: Admin image review queue with evidence

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F01-image-review-queue
**Type:** AFK
**Status:** open
**Blocked by:** #021, #012
**Priority:** high
**Branch:** feature/039-admin-image-review-queue

## Goal
Admins see every photo waiting for review, with the photo itself and all the evidence the pipeline gathered.

## User Story
As an admin, I want to see why a photo was flagged, so that I can make a quick, fair decision.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/admin/queues/:queue (images item shape)
- docs/schema.md: image_checks (car_check, ai_check, metadata_signals, phash_match)
- CLAUDE.md: deep modules (moderation.service public API is capped at 8 exports: listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension, setListingCap, listAuditLog)

### System specs
- docs/systems/image-verification.md: Alternative path (uncertain → admin), Decision table reasons

## Acceptance Criteria
- [ ] `listQueue(db, 'images', page)` returns in_review, non-deleted photos oldest first, each with: a signed quarantine URL (10 min), listing title + status + shop, car_check, ai_check score, metadata_signals, phash_match (with a signed URL of the matched photo), decision_reason
- [ ] Non-admins → FORBIDDEN
- [ ] /admin/images shows cards: the photo (click to enlarge), 'AI score 0.72 (review ≥ 0.50, reject ≥ 0.90)', 'Car: yes (0.93), exterior', 'Screen/print: no', 'EXIF: none', a side-by-side matched photo when pHash matched, and the listing link
- [ ] The /admin dashboard shows the images queue count

## Files to Modify
- src/services/moderation.service.ts: `listQueue` images branch
- src/app/api/admin/queues/[queue]/route.ts: allow 'images'
- src/app/admin/images/page.tsx
- src/components/admin/ImageEvidence.tsx
- src/app/admin/page.tsx: images count

**Test files (in scope):**
- tests/services/moderation-images-queue.test.ts
- src/components/admin/ImageEvidence.test.tsx

## Out of Scope
- Approve/reject actions (040)

## Implementation Plan

Step 1: listQueue images
Test 1: tests/services/moderation-images-queue.test.ts → after processing borderline-ai.jpg (fake) → the queue has 1 item with ai_check.score 0.7 and a signed_url starting with the storage URL and containing 'token='; a passed photo isn't in the queue
File:   moderation.service.ts

Step 2: pHash match evidence
Test 2: the same photo from a second shop → the item has phash_match.matched_signed_url and matched_shop name
File:   moderation.service.ts

Step 3: ImageEvidence
Test 3: ImageEvidence.test.tsx → renders 'AI score 0.70' and the threshold hint from the settings passed in; renders 'Possible reused photo' with two images when phash_match is present
File:   ImageEvidence.tsx

Step 4: Page + route
Test 4: GET /api/admin/queues/images as admin → 200; /admin/images lists the cards oldest first; the dashboard shows 'Photos to review: 1'
File:   route, pages

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- moderation-images-queue

### Manual verification
1. Upload borderline-ai.jpg to a listing; as admin open /admin/images → the photo with AI score 0.70 and the evidence panel

## Git
- Branch: feature/039-admin-image-review-queue
- Commit: feat(admin): add admin image review queue with evidence closes #039
- PR title: 039 Admin image review queue with evidence
