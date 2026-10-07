# Issue 047: Admin audit log

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F04-suspensions-settings-audit
**Type:** AFK
**Status:** open
**Blocked by:** #046
**Priority:** normal
**Branch:** feature/047-audit-log

## Goal
Admins can browse every admin action (who, what, target, reason, before/after), and the log provably can't be edited.

## User Story
As the business, I want a trustworthy record of every moderation decision.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/admin/audit-log
- docs/schema.md: admin_actions (append-only)
- CLAUDE.md: deep modules (moderation.service public API is capped at 8 exports: listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension, setListingCap, listAuditLog)

### System specs
- docs/systems/shop-onboarding.md: INV-S4 (one audit row per admin transition)

## Acceptance Criteria
- [x] `listAuditLog(db, { page, target_type?, target_id? })` newest first, 50 per page, with the actor display name
- [x] /admin/audit-log shows a table with filters (target type, target id) and expandable details JSON; each target links to the relevant page
- [x] A cross-cutting test proves every admin action from 012, 040, 042, 044, 045 and 046 writes exactly one row with a non-empty action and target
- [x] No UPDATE/DELETE is possible on admin_actions for admins, users or the service role

## Files to Modify
- src/services/moderation.service.ts: `listAuditLog`
- src/app/api/admin/audit-log/route.ts
- src/app/admin/audit-log/page.tsx
- src/app/admin/layout.tsx: nav link

**Test files (in scope):**
- tests/services/audit-log.test.ts
- tests/rls/audit-append-only.test.ts

## Out of Scope
- Exporting the audit log

## Implementation Plan

Step 1: listAuditLog
Test 1: tests/services/audit-log.test.ts → after approve shop + reject image, `listAuditLog(admin, {})` returns 2 rows newest first with actor_name 'Admin'; filter target_type 'shop' → 1
File:   moderation.service.ts

Step 2: Every admin action audited
Test 2: perform one of each admin action (shop approve/reject/suspend/unsuspend, cap, image approve/reject, listing clear-flag/reject/remove, report dismiss, setting update) → the count of admin_actions increases by exactly 1 per action
File:   (integration across existing RPCs)

Step 3: Append-only
Test 3: tests/rls/audit-append-only.test.ts → admin update → error; adminDb (service role) delete → error 'APPEND_ONLY'
File:   (verifies the 002 trigger)

Step 4: Route + page
Test 4: GET /api/admin/audit-log?target_type=shop as admin → 200; the page renders a row 'shop.approve · Coastal Cars · Admin · 2 min ago'
File:   route, page, layout

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- audit-log audit-append-only

### Manual verification
1. Approve a shop and suspend it → /admin/audit-log shows both entries with reasons
2. In SQL try `delete from admin_actions` → error APPEND_ONLY

## Git
- Branch: feature/047-audit-log
- Commit: feat(admin): add admin audit log closes #047
- PR title: 047 Admin audit log
