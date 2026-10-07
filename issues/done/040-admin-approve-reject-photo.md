# Issue 040: Admin approve or reject a reviewed photo

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F01-image-review-queue
**Type:** AFK
**Status:** open
**Blocked by:** #039, #025
**Priority:** high
**Branch:** feature/040-admin-approve-reject-photo

## Goal
Admin decisions on photos take effect end to end: approved photos are cleaned and published and the listing re-evaluates; rejected photos stay private (or are unpublished) with a reason.

## User Story
As an admin, I want my decision to update the seller's listing automatically.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/admin/images/:id/approve|reject
- docs/schema.md: image_checks.forced_decision
- docs/decisions.md: ADR-011

### System specs
- docs/systems/image-verification.md: transitions admin_approve, admin_reject; Pipeline step 2 (forced decision)
- docs/systems/listing-lifecycle.md: Evaluate rules (after admin action)

## Acceptance Criteria
- [ ] `admin_approve_image(id)` (in_review only) inserts a job with forced_decision 'passed' and writes audit `image.approve`; the job runner skips the vendors, strips/encodes/publishes, marks passed, then evaluate_listing (→ live if everything passes and there are no flags)
- [ ] `admin_reject_image(id, reason)` (in_review or passed) → rejected with the reason; if it was passed, the public variants are removed (unpublish-image); audit `image.reject`; evaluate_listing (a checking/in_review listing → rejected; a live listing stays live if ≥ 4 passed remain, otherwise → in_review with flag image_review)
- [ ] Reason required for reject (5–500) → 422 REASON_REQUIRED; wrong state → 409 INVALID_STATE
- [ ] /admin/images cards have Approve / Reject (ReasonDialog) buttons; the item leaves the queue after the action

## Files to Modify
- supabase/migrations/20260928004000_admin_image_decisions.sql
- src/server/jobs/image-verification/pipeline.ts: forced_decision path
- src/services/moderation.service.ts: `decideImage`
- src/app/api/admin/images/[id]/[action]/route.ts
- src/app/admin/images/page.tsx: actions

**Test files (in scope):**
- tests/services/moderation-image-decisions.test.ts

## Out of Scope
- Bulk actions

## Implementation Plan

Step 1: Approve path
Test 1: tests/services/moderation-image-decisions.test.ts → a listing with 3 passed + 1 in_review photo; `decideImage(admin, id, 'approve')` then `processNextJobs()` → the photo is passed with public_paths, and no vendor call is made (the fake provider call counter stays 0); the listing → live; 1 admin_actions row
File:   migration, pipeline.ts, moderation.service.ts

Step 2: Reject path
Test 2: reject an in_review photo on a checking listing → the photo is rejected with the reason and the listing → rejected; reject a passed photo on a live listing with 5 passed → the variants are deleted, and the listing stays live with 4
File:   migration, pipeline.ts

Step 3: Live drops below 4
Test 3: reject a passed photo on a live listing with exactly 4 passed → the listing → in_review with review_flags containing 'image_review'
File:   migration

Step 4: Guards + route + UI
Test 4: reject with reason 'bad' → REASON_REQUIRED; approving a passed photo → INVALID_STATE; a non-admin → FORBIDDEN; the page's Approve removes the card
File:   route, page

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/image-verification.md:**
- Forced decisions skip vendor calls but still strip metadata and publish (INV-I2)
- admin_reject on a passed photo must unpublish its variants (INV-I1)

**From docs/systems/listing-lifecycle.md:**
- INV-L2: a live listing must keep ≥ 4 passed photos, otherwise → in_review (flag image_review)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-image-decisions

### Manual verification
1. Approve the borderline photo in /admin/images → within a minute the seller's photo turns green, and the listing goes Live if the rest passed
2. Reject another with a reason → the seller sees that reason on the chip

## Git
- Branch: feature/040-admin-approve-reject-photo
- Commit: feat(admin): add admin photo approval and rejection closes #040
- PR title: 040 Admin approve or reject a reviewed photo
