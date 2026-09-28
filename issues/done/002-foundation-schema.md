# Issue 002: Foundation schema: profiles, helper functions, settings, audit log, email outbox

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** #001
**Priority:** critical
**Branch:** feature/002-foundation-schema

## Goal
The database has the shared foundation every feature uses, all protected by RLS, and it's proven by RLS tests.

## User Story
As the platform, I want user profiles, settings, an append-only audit log and an email outbox, so that later features build on a secure base.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: Conventions, Enums (user_role, account_status), profiles, admin_actions, app_settings, notifications
- docs/decisions.md: ADR-010 (outbox), ADR-011
- docs/env.md: src/lib/env.ts

## Acceptance Criteria
- [ ] Signing up a user creates a `profiles` row with role `user`, status `active`, display_name = email local part
- [ ] A user can read and update only their own `display_name`; updating `role` or `status` as that user fails
- [ ] `admin_actions` rows can't be updated or deleted by anyone, including the service role (trigger raises)
- [ ] `app_settings` is seeded with every key and default from docs/schema.md
- [ ] `enqueue_notification(user_id, kind, ref_id, payload)` inserts a pending row, and returns null without inserting for a duplicate `new_message` within 15 minutes
- [ ] `src/lib/env.ts` exports a validated `env` (throws on a missing NEXT_PUBLIC_SUPABASE_URL); `src/lib/logger.ts` writes one JSON line per call with level, msg, time

## Files to Modify
- supabase/migrations/20260928000200_foundation.sql: enums, set_updated_at, profiles + handle_new_user, is_admin/is_active_user, app_settings + seed, admin_actions + append-only trigger, notifications + enqueue_notification, RLS + column grants
- supabase/config.toml: email confirmations on, site_url, Google provider via env(), `[auth.sms.test_otp]` +61400000000=123456
- supabase/seed.sql: dev admin `admin@carmart.local` (role admin)
- src/lib/env.ts
- src/lib/logger.ts
- src/services/notification.service.ts: `enqueue(kind, userId, refId, payload)`

**Test files (in scope):**
- tests/rls/foundation.test.ts
- src/lib/env.test.ts
- src/lib/logger.test.ts
- tests/helpers/supabase-test.ts (resetDb keeps seed accounts @carmart.local)

## Out of Scope
- Shops, listings or any feature table
- Sending emails (issue 006)

## Implementation Plan

Step 1: profiles + handle_new_user trigger
Test 1: tests/rls/foundation.test.ts → after `createUser({ email: 'jo@x.au' })`, `adminDb().from('profiles').select('role,status,display_name').eq('id', u.id).single()` returns `{ role: 'user', status: 'active', display_name: 'jo' }`
File:   migration, tests/rls/foundation.test.ts

Step 2: profiles RLS + column grants
Test 2: `asUser(a).from('profiles').update({ display_name: 'Jo B' }).eq('id', a.id)` → error null; `.update({ role: 'admin' })` → error with code '42501'; `asUser(a).from('profiles').select('id').eq('id', b.id)` → 0 rows; anon → 0 rows
File:   migration

Step 3: is_admin() + admin read-all
Test 3: seeded admin via `createUser({ role: 'admin' })`: `asUser(admin).from('profiles').select('id')` returns ≥ 2 rows
File:   migration, supabase/seed.sql

Step 4: app_settings seed + admin-only access
Test 4: `adminDb().from('app_settings').select('key,value')` contains `ai_reject_threshold` = 0.9, `ai_review_threshold` = 0.5, `listing_expiry_days` = 60 (14 keys total (max_photos and min_photos are separate keys)); `asUser(user).from('app_settings').select('key')` → 0 rows
File:   migration

Step 5: admin_actions append-only
Test 5: insert a row via adminDb, then `adminDb().from('admin_actions').update({ reason: 'x' }).eq('id', id)` → error message contains 'APPEND_ONLY'; delete → same
File:   migration

Step 6: notifications outbox + enqueue_notification + TS wrapper
Test 6: `adminDb().rpc('enqueue_notification', { p_user: u.id, p_kind: 'new_message', p_ref: c, p_payload: {} })` twice within 15 min → first returns a uuid, second returns null, table has 1 row; `notification.service.enqueue('shop_approved', u.id, s, {})` returns `{ ok: true }`
File:   migration, src/services/notification.service.ts

Step 7: env + logger
Test 7: src/lib/env.test.ts → parsing `{}` throws ZodError mentioning NEXT_PUBLIC_SUPABASE_URL; src/lib/logger.test.ts → `logger.info('hi', { a: 1 })` writes one line whose JSON has `level: 'info', msg: 'hi', a: 1` and an ISO `time`
File:   src/lib/env.ts, src/lib/logger.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset

### Automated tests
npm run test (env, logger) && npm run test:integration (foundation RLS: 7 tests)

### Manual verification
1. In Supabase Studio (http://127.0.0.1:54323) sign up a user in Auth → a profiles row appears
2. Try to delete a row from admin_actions in SQL editor → error APPEND_ONLY

## Git
- Branch: feature/002-foundation-schema
- Commit: feat(db): add foundation schema with profiles, settings, audit log and email outbox closes #002
- PR title: 002 Foundation schema: profiles, helper functions, settings, audit log, email outbox
