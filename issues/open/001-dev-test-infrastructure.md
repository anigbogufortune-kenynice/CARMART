# Issue 001: Dev and test infrastructure (integration harness, CI, lint guard, Playwright)

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** nothing
**Priority:** critical
**Branch:** feature/001-dev-test-infrastructure

## Goal
Every later issue can run unit, integration (real local Supabase) and E2E tests, and CI enforces them on every PR.

## User Story
As the development team, I want a reliable test harness and CI, so that every issue is verified the same way.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/architecture.md: Deployment Overview (CI steps)
- docs/auth.md: Secrets and keys (service-role import restriction)
- CLAUDE.md: TDD rules, Test Integrity

## Acceptance Criteria
- [ ] `npm run test:integration` runs `tests/**/*.test.ts` with Vitest in Node (not jsdom), serially, against the local Supabase stack
- [ ] `tests/helpers/supabase-test.ts` exports `resetDb`, `createUser`, `asUser`, `adminDb`, `anonDb` with the behaviour described in ISSUE_CONVENTIONS
- [ ] ESLint fails when any file outside `src/server/jobs/**` and `tests/**` imports `@/server/jobs/supabase-admin` or reads `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `npm run test:e2e` runs Playwright (Chromium, baseURL http://localhost:3000, `webServer` starts `npm run dev`)
- [ ] `.github/workflows/ci.yml` runs lint → type-check → unit → supabase start → db reset → integration → e2e → build on pull requests and on pushes to main

## Files to Modify
- package.json: scripts `test:integration`, `test:e2e`; devDeps `@playwright/test`, `@axe-core/playwright`, `dotenv`
- vitest.integration.config.mts: node env, include `tests/**/*.test.ts`, `fileParallelism: false`, setupFiles loading `.env.test`
- tests/helpers/supabase-test.ts
- .eslintrc.json: `no-restricted-imports` + `no-restricted-properties` (process.env.SUPABASE_SERVICE_ROLE_KEY) with overrides for `src/server/jobs/**` and `tests/**`
- playwright.config.ts
- .github/workflows/ci.yml

**Test files (in scope):**
- tests/harness.test.ts
- src/lint-guard.test.ts
- .env.test (local stack defaults + fake providers)

## Out of Scope
- Any database table (issue 002)
- Application pages

## Implementation Plan

Step 1: Integration Vitest config + npm script
Test 1: tests/harness.test.ts → `(await anonDb().auth.getSession()).data.session` is null, and `(await adminDb().auth.admin.listUsers()).error` is null (proves both clients reach the local stack)
File:   vitest.integration.config.mts, package.json, tests/harness.test.ts

Step 2: createUser / asUser helpers
Test 2: tests/harness.test.ts → `const u = await createUser({ email: 'a@test.local', verified: true })` returns `{ id, email, password }`; `(await asUser(u).auth.getUser()).data.user.id === u.id`; `createUser({ verified: false })` user has `email_confirmed_at === null`
File:   tests/helpers/supabase-test.ts

Step 3: resetDb truncates app tables (no-op list for now, extended by later issues via an exported TABLES array)
Test 3: tests/harness.test.ts → after `createUser` then `await resetDb()`, `adminDb().auth.admin.listUsers()` returns 0 users
File:   tests/helpers/supabase-test.ts

Step 4: Lint guard for the service role
Test 4: src/lint-guard.test.ts → run ESLint programmatically on a virtual file `src/app/x.ts` containing `import { adminClient } from '@/server/jobs/supabase-admin'` → 1 error with ruleId `no-restricted-imports`; the same code at `src/server/jobs/x.ts` → 0 errors
File:   .eslintrc.json, src/lint-guard.test.ts

Step 5: Playwright config + CI workflow
Test 5: `npx playwright test --list` exits 0; `ci.yml` parses (`npx yaml-lint` or `node -e "require('yaml').parse(...)"`) and contains the jobs in the AC order
File:   playwright.config.ts, .github/workflows/ci.yml

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset

### Automated tests
npm run test && npm run test:integration (harness: 4 tests) && npm run lint

### Manual verification
1. Run `npm run test:integration` with Supabase stopped: it fails fast with a clear 'Supabase not running' message
2. Add a forbidden import in any page file: `npm run lint` fails with no-restricted-imports

## Git
- Branch: feature/001-dev-test-infrastructure
- Commit: feat(infra): add integration harness, CI workflow and service-role lint guard closes #001
- PR title: 001 Dev and test infrastructure (integration harness, CI, lint guard, Playwright)
