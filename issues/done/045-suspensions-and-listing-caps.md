# Issue 045: Suspend and unsuspend shops and users, and set listing caps

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F04-suspensions-settings-audit
**Type:** AFK
**Status:** open
**Blocked by:** #044
**Priority:** high
**Branch:** feature/045-suspensions-and-listing-caps

## Goal
Admins can suspend bad actors (their listings vanish at once), reverse it, and raise a shop's active-listing cap.

## User Story
As an admin, I want to stop a scammer instantly, and give good dealers more room.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Admin (shops suspend/unsuspend, listing-cap, users suspend/unsuspend)
- docs/auth.md: Roles (suspended)
- CLAUDE.md: deep modules (moderation.service public API is capped at 8 exports: listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension, setListingCap, listAuditLog)

### System specs
- docs/systems/shop-onboarding.md: suspend/unsuspend transitions, BR-S7, EC-S4, EC-S5
- docs/systems/listing-lifecycle.md: EC-L5 (suspended shop's listings hidden, restored on unsuspend)

## Acceptance Criteria
- [ ] `setSuspension('shop', id, true, reason)` → the shop is suspended from draft/pending/approved; its listings disappear publicly (RLS) without changing listing states
- [ ] `setSuspension('shop', id, false, reason)` → approved; refused with 409 OWNER_SUSPENDED if the owner profile is suspended
- [ ] `setSuspension('user', id, true, reason)` → profile suspended AND their shop suspended (BR-S7); the user is locked out (middleware from 005); unsuspending the user doesn't unsuspend the shop
- [ ] `setListingCap(shopId, cap 1–1000, reason)`
- [ ] All actions write audit rows; a reason is required (5–500)
- [ ] /admin/shops gets a search box (name/slug) listing all shops with Suspend/Unsuspend and 'Listing cap' controls

## Files to Modify
- supabase/migrations/20260928004500_suspensions_caps.sql
- src/services/moderation.service.ts: `setSuspension`, `setListingCap`
- src/app/api/admin/shops/[id]/[action]/route.ts: enable suspend|unsuspend
- src/app/api/admin/shops/[id]/listing-cap/route.ts
- src/app/api/admin/users/[id]/[action]/route.ts
- src/app/admin/shops/page.tsx: all-shops search + controls

**Test files (in scope):**
- tests/services/moderation-suspensions.test.ts

## Out of Scope
- Timed suspensions
- Appeals

## Implementation Plan

Step 1: Shop suspend/unsuspend
Test 1: tests/services/moderation-suspensions.test.ts → suspending an approved shop with 2 live listings → searchListings returns 0 of them, and the listings stay 'live'; unsuspend → they're visible again
File:   migration, moderation.service.ts

Step 2: User suspend
Test 2: suspend the owner → profile suspended and the shop suspended; GET /api/profile/me as them → 403 ACCOUNT_SUSPENDED; unsuspend the user → profile active, the shop still suspended; unsuspending the shop while the owner is suspended → OWNER_SUSPENDED
File:   migration

Step 3: Listing cap
Test 3: setListingCap(shop, 25, 'Trusted dealer') → listing_cap 25; cap 0 → VALIDATION_ERROR; the audit row has details.before = 10, after = 25
File:   migration, moderation.service.ts

Step 4: Routes + UI
Test 4: POST /api/admin/users/:id/suspend without a reason → 422; /admin/shops search 'coastal' finds the shop, and Suspend opens ReasonDialog
File:   routes, page

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- suspend from draft/pending_approval/approved; unsuspend → approved; EC-S5 refuse unsuspend while the owner is suspended
- BR-S7: suspending a user suspends their shop

**From docs/systems/listing-lifecycle.md:**
- EC-L5: listing states are unchanged; visibility comes from the shop status (INV-L3)

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-suspensions

### Manual verification
1. Suspend a shop → its cars vanish from /cars; unsuspend → back
2. Suspend a user → they're redirected to /suspended on /sell
3. Raise the cap to 25 → the seller can submit an 11th listing

## Git
- Branch: feature/045-suspensions-and-listing-caps
- Commit: feat(admin): add shop and user suspensions and listing caps closes #045
- PR title: 045 Suspend and unsuspend shops and users, and set listing caps
