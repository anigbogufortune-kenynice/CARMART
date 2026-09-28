# Issue 012: Approve or reject a shop, with audit log and emails

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F04-admin-shop-approval
**Type:** AFK
**Status:** open
**Blocked by:** #011, #006
**Priority:** high
**Branch:** feature/012-admin-approve-reject-shop

## Goal
An admin approves or rejects a pending shop; the change, audit row and email happen atomically, and the email is actually dispatched.

## User Story
As an admin, I want to approve or reject shops with a reason, so that only real sellers go public.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/admin/shops/:id/approve|reject
- docs/schema.md: admin_actions, notifications, Scheduled jobs (pg_net dispatch)
- docs/decisions.md: ADR-010, ADR-011

### System specs
- docs/systems/shop-onboarding.md: transitions approve/reject, INV-S4, BR-S8, EC-S3

## Acceptance Criteria
- [ ] `admin_approve_shop(id)` pending_approval → approved (approved_at set), writes admin_actions `shop.approve`, enqueues `shop_approved`
- [ ] `admin_reject_shop(id, reason)` requires reason 5–500 chars (422 REASON_REQUIRED), → rejected with status_reason, audit `shop.reject`, enqueues `shop_rejected`
- [ ] Non-pending → 409 INVALID_STATE; concurrent decisions → the second gets INVALID_STATE
- [ ] An AFTER INSERT trigger on notifications + a pg_cron minute job call /api/internal/dispatch-notifications via pg_net with the Vault secret
- [ ] /admin/shops has Approve and Reject (with a reason dialog) buttons; after approval /shops/[slug] is public

## Files to Modify
- supabase/migrations/20260928001200_admin_shop_decisions.sql: RPCs + pg_net/pg_cron dispatch wiring (reads Vault `internal_job_secret`, `app_base_url`)
- src/services/moderation.service.ts: `decideShop(db, id, 'approve'|'reject', reason?)`
- src/app/api/admin/shops/[id]/[action]/route.ts: approve|reject (suspend/unsuspend return 404 until issue 045)
- src/server/jobs/notification-dispatch/templates.ts: finalise shop_approved/shop_rejected copy
- src/components/admin/ReasonDialog.tsx
- src/app/admin/shops/page.tsx
- src/components/admin/ShopDecisionButtons.tsx: approve/reject actions (client)

**Test files (in scope):**
- tests/services/moderation-shops.test.ts
- src/components/admin/ReasonDialog.test.tsx
- e2e/shop-approval.spec.ts

## Out of Scope
- Suspend/unsuspend (045)

## Implementation Plan

Step 1: admin_approve_shop
Test 1: tests/services/moderation-shops.test.ts → `decideShop(asUser(admin), id, 'approve')` → status approved, approved_at set, 1 admin_actions row `{ action: 'shop.approve', target_id: id }`, 1 pending notification kind shop_approved for the owner
File:   migration, src/services/moderation.service.ts

Step 2: admin_reject_shop + reason
Test 2: reason 'no' → REASON_REQUIRED; reason 'Name is misleading' → rejected, status_reason set, audit `shop.reject` with reason, notification shop_rejected with payload.reason
File:   migration

Step 3: State + role guards
Test 3: approving an approved shop → INVALID_STATE; a normal user calling the RPC → FORBIDDEN; two parallel `decideShop` approve calls → exactly one ok, one INVALID_STATE
File:   migration

Step 4: Dispatch wiring
Test 4: inserting a notification fires `net.http_post` (assert a row in `net.http_request_queue` with url ending `/api/internal/dispatch-notifications`)
File:   migration

Step 5: Route + UI
Test 5: POST /api/admin/shops/:id/reject `{}` → 422 REASON_REQUIRED; ReasonDialog.test.tsx → Confirm is disabled until ≥ 5 chars are typed
File:   route, src/components/admin/ReasonDialog.tsx, src/app/admin/shops/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- Transitions pending_approval → approved | rejected; guard is_admin(); rejection reason 5–500 chars
- INV-S4: exactly one admin_actions row per admin transition, in the same transaction
- EC-S3: concurrent admin decisions → SELECT … FOR UPDATE; the second gets 409 INVALID_STATE

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev && set the Vault secrets: select vault.create_secret('<INTERNAL_JOB_SECRET>','internal_job_secret'); select vault.create_secret('http://host.docker.internal:3000','app_base_url');

### Automated tests
npm run test && npm run test:integration -- moderation-shops

### Manual verification
1. As admin, approve 'Coastal Cars' in /admin/shops → it leaves the queue
2. /shops/coastal-cars is now public, with a Verified badge
3. The dev-server log shows the 'Your shop is live' email within a minute
4. Reject another pending shop with a reason → the owner's /sell shows the reason

## Git
- Branch: feature/012-admin-approve-reject-shop
- Commit: feat(admin): add shop approval and rejection with audit log and email dispatch closes #012
- PR title: 012 Approve or reject a shop, with audit log and emails
