# Issue 010: Submit my shop for approval

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F03-phone-verification-and-submit
**Type:** AFK
**Status:** open
**Blocked by:** #009
**Priority:** high
**Branch:** feature/010-submit-shop-for-approval

## Goal
An owner with a verified phone submits the shop; it moves to pending_approval and the checklist shows 'Waiting for approval'.

## User Story
As a shop owner, I want to submit my shop, so that an admin can approve it and it goes public.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/shops/me/submit
- docs/schema.md: shops.submitted_at, version

### System specs
- docs/systems/shop-onboarding.md: transitions draft→pending_approval and rejected→pending_approval, INV-S3, BR-S4

## Acceptance Criteria
- [ ] `submit_shop()` RPC (security definer) moves draft or rejected → pending_approval, sets submitted_at, clears status_reason, version++
- [ ] Without a verified phone → 422 PHONE_NOT_VERIFIED
- [ ] From pending_approval, approved or suspended → 409 INVALID_STATE
- [ ] /sell shows a 'Submit for approval' button when steps 1–2 are done, then 'Waiting for approval'; a rejected shop shows the rejection reason and 'Resubmit'

## Files to Modify
- supabase/migrations/20260928001000_submit_shop.sql: `submit_shop()`
- src/services/shop.service.ts: `submitMyShop`
- src/app/api/shops/me/submit/route.ts
- src/app/sell/page.tsx
- src/components/shop/SellChecklist.tsx: submit / resubmit action + waiting state (client component)

**Test files (in scope):**
- tests/services/shop-submit.test.ts

## Out of Scope
- The admin approval queue (011, 012)

## Implementation Plan

Step 1: submit_shop RPC guards
Test 1: tests/services/shop-submit.test.ts → owner without a phone: `rpc('submit_shop')` error message 'PHONE_NOT_VERIFIED'; with a phone: status becomes pending_approval, submitted_at set, version 2
File:   migration

Step 2: Illegal states
Test 2: for each status in [pending_approval, approved, suspended] set via adminDb → rpc error 'INVALID_STATE'; rejected with status_reason 'x' → pending_approval and status_reason null
File:   migration

Step 3: Service + route mapping
Test 3: `submitMyShop(db)` maps 'PHONE_NOT_VERIFIED' → `{ code: 'PHONE_NOT_VERIFIED' }` (422) and 'INVALID_STATE' → 409
File:   src/services/shop.service.ts, src/app/api/shops/me/submit/route.ts

Step 4: Checklist states
Test 4: render /sell for the states draft (no phone) → button disabled with a hint 'Verify your phone first'; pending_approval → 'Waiting for approval'; rejected → reason text + 'Resubmit' button
File:   src/app/sell/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- Transitions: draft --submit--> pending_approval and rejected --submit--> pending_approval; guard: owner, phone verified, required fields valid
- INV-S3 (phone verified at submit time), with a test
- Every other (state, submit) pair → 409 INVALID_STATE, with a test per state

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- shop-submit

### Manual verification
1. With the phone verified, click 'Submit for approval' on /sell → 'Waiting for approval'
2. With a fresh user (no phone) the button is disabled with 'Verify your phone first'

## Git
- Branch: feature/010-submit-shop-for-approval
- Commit: feat(shops): add shop submission for approval closes #010
- PR title: 010 Submit my shop for approval
