# Issue 011: Admin area and the pending-shops queue

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F04-admin-shop-approval
**Type:** AFK
**Status:** open
**Blocked by:** #010
**Priority:** high
**Branch:** feature/011-admin-area-and-shop-queue

## Goal
Admins get a protected /admin area whose first screen lists shops waiting for approval, oldest first.

## User Story
As an admin, I want to see which shops are waiting, so that I can review them in order.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Admin: GET /api/admin/queues/:queue
- docs/auth.md: Protected routes (/admin → 404 for non-admins)
- docs/architecture.md: Page map (/admin)

## Acceptance Criteria
- [ ] Non-admins (and visitors) get a 404 on every /admin page and 403 FORBIDDEN on /api/admin/*
- [ ] GET /api/admin/queues/shops returns pending_approval shops oldest first by submitted_at, 24 per page, with owner display name and phone-verified flag
- [ ] An unknown queue name → 404
- [ ] /admin shows queue counts; /admin/shops lists the pending shops

## Files to Modify
- src/services/moderation.service.ts: `listQueue(db, queue, page)` (shops queue only for now)
- src/app/api/admin/queues/[queue]/route.ts
- src/app/admin/layout.tsx: admin guard (notFound for non-admins) + nav
- src/app/admin/page.tsx
- src/app/admin/shops/page.tsx

**Test files (in scope):**
- tests/services/moderation-queues.test.ts
- e2e/admin-guard.spec.ts (the layout guard is proven end to end instead of by mocking internal modules)

## Out of Scope
- Approve/reject actions (012)
- The other queues (039, 041, 044)

## Implementation Plan

Step 1: listQueue('shops')
Test 1: tests/services/moderation-queues.test.ts → with 3 pending shops submitted at t1<t2<t3 plus 1 draft, `listQueue(asUser(admin), 'shops', 1)` returns ids in order [t1,t2,t3] and `page.total = 3`; as a normal user → `{ ok: false, error: { code: 'FORBIDDEN' } }`
File:   src/services/moderation.service.ts

Step 2: Queue route
Test 2: GET /api/admin/queues/shops as a user → 403; as admin → 200; /api/admin/queues/bogus → 404
File:   src/app/api/admin/queues/[queue]/route.ts

Step 3: Admin layout guard
Test 3: layout render with a non-admin profile → `notFound()` called; with admin → nav links Shops (and placeholders for later queues)
File:   src/app/admin/layout.tsx

Step 4: Dashboard + shops page
Test 4: /admin shows 'Shops waiting: 3'; /admin/shops lists 'Coastal Cars · Parramatta NSW · submitted 2 days ago · phone verified ✓'
File:   src/app/admin/page.tsx, src/app/admin/shops/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-queues

### Manual verification
1. Sign in as admin@carmart.local (seed), open /admin/shops → the shop from issue 010 is listed
2. Sign in as a normal user, open /admin → 404

## Git
- Branch: feature/011-admin-area-and-shop-queue
- Commit: feat(admin): add admin area and pending-shops queue closes #011
- PR title: 011 Admin area and the pending-shops queue
