# Issue 006: Job runner foundation and email dispatch (log provider)

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** #002
**Priority:** high
**Branch:** feature/006-job-runner-and-email-dispatch

## Goal
Background jobs have one secure home: an internal route authenticated by a secret, a single service-role client, and a working email dispatcher.

## User Story
As the platform, I want queued emails to be sent reliably, so that users are told about important changes.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/architecture.md: Components, Data Flow (Email)
- docs/api-contracts.md: Internal: POST /api/internal/dispatch-notifications
- docs/env.md: Job runner, src/server/jobs/env.ts
- docs/decisions.md: ADR-006, ADR-010

## Acceptance Criteria
- [ ] `src/server/jobs/supabase-admin.ts` is the only module that creates a service-role client (the lint rule from 001 passes)
- [ ] `/api/internal/dispatch-notifications` returns 401 without `Authorization: Bearer <INTERNAL_JOB_SECRET>` (constant-time compare), and runs in the Node runtime
- [ ] Dispatch claims up to 50 pending rows, renders a template per kind, sends through the provider (`log` writes the email to the logger; `resend` uses the Resend SDK), and marks each `sent`; a failure increments attempts and marks `failed` at 5
- [ ] Unknown kinds are marked `skipped` and logged
- [ ] Templates exist for `shop_approved` and `shop_rejected` (subject + text + simple HTML; links use NEXT_PUBLIC_SITE_URL)

## Files to Modify
- src/server/jobs/supabase-admin.ts
- src/server/jobs/env.ts
- src/server/jobs/internal-auth.ts: `requireInternalSecret(request)`
- src/server/jobs/notification-dispatch/dispatch.ts: `dispatchPending(limit)`
- src/server/jobs/notification-dispatch/templates.ts
- src/app/api/internal/dispatch-notifications/route.ts

**Test files (in scope):**
- src/server/jobs/internal-auth.test.ts
- src/server/jobs/notification-dispatch/templates.test.ts
- tests/jobs/dispatch.test.ts

## Out of Scope
- pg_net triggers / pg_cron schedules (issue 012)
- Other templates (added by their feature issues)

## Implementation Plan

Step 1: Jobs env + service-role client
Test 1: jobsEnv parsing with `CAR_CHECK_PROVIDER: 'claude'` and no ANTHROPIC_API_KEY throws 'ANTHROPIC_API_KEY required'; the fake/log config parses
File:   src/server/jobs/env.ts, src/server/jobs/supabase-admin.ts

Step 2: Internal auth
Test 2: internal-auth.test.ts → `requireInternalSecret(req('Bearer wrong'))` → `{ ok: false }`; the correct secret → `{ ok: true }`; a missing header → `{ ok: false }`; uses `crypto.timingSafeEqual` (a length mismatch returns false without throwing)
File:   src/server/jobs/internal-auth.ts

Step 3: Templates
Test 3: templates.test.ts → `render('shop_rejected', { shopName: 'Coastal Cars', reason: 'Blurry name' })` returns a subject containing 'Coastal Cars' and text containing 'Blurry name' and `${SITE_URL}/sell`; `render('nope', {})` → `{ ok: false, error: { code: 'UNKNOWN_TEMPLATE' } }`
File:   src/server/jobs/notification-dispatch/templates.ts

Step 4: dispatchPending
Test 4: tests/jobs/dispatch.test.ts → enqueue 2 `shop_approved` + 1 `bogus` via SQL; `dispatchPending(50)` returns `{ sent: 2, skipped: 1, failed: 0 }` and rows have status sent/sent/skipped; a provider throwing on send leaves the row pending with attempts 1
File:   src/server/jobs/notification-dispatch/dispatch.ts

Step 5: Internal route
Test 5: POST without the header → 401 `{ error: { code: 'UNAUTHENTICATED' } }`; with the header → 200 `{ data: { sent: n } }`
File:   src/app/api/internal/dispatch-notifications/route.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- dispatch

### Manual verification
1. Insert a pending shop_approved notification for your user in Studio
2. curl -X POST localhost:3000/api/internal/dispatch-notifications -H "Authorization: Bearer $INTERNAL_JOB_SECRET" → {"data":{"sent":1}} and the email is printed in the dev-server log
3. The same curl without the header → 401

## Git
- Branch: feature/006-job-runner-and-email-dispatch
- Commit: feat(jobs): add job runner foundation and email dispatch closes #006
- PR title: 006 Job runner foundation and email dispatch (log provider)
