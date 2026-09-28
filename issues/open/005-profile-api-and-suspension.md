# Issue 005: Profile API, route helpers, profile page and suspended-account handling

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** #004
**Priority:** high
**Branch:** feature/005-profile-api-and-suspension

## Goal
Route handlers share one tested pipeline (Zod → auth → service → response), users can edit their display name, and suspended users are locked out.

## User Story
As a member, I want to manage my profile; as the platform, I want suspended users blocked everywhere.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Conventions, Global error codes, GET/PATCH /api/profile/me
- docs/auth.md: Authorisation layers, Roles (suspended)
- CLAUDE.md: Error Handling

## Acceptance Criteria
- [ ] `withRoute({ auth: 'public'|'user'|'admin', body?, query? }, handler)` returns 422 VALIDATION_ERROR on Zod failure, 401 UNAUTHENTICATED without a session, 403 EMAIL_NOT_VERIFIED, 403 ACCOUNT_SUSPENDED, 403 FORBIDDEN for a non-admin on admin routes, and maps `Result` errors to their HTTP status
- [ ] Unexpected throws return 500 INTERNAL_ERROR with a request id, and are logged, never leaking details
- [ ] GET /api/profile/me returns `{ id, display_name, role, phone, phone_verified, has_shop }`; PATCH updates display_name (1–60 chars, strict body)
- [ ] `/account/profile` shows and edits the display name
- [ ] Middleware redirects a suspended user from any `/account`, `/sell` or `/admin` page to `/suspended`

## Files to Modify
- src/lib/api/route-helpers.ts
- src/services/profile.service.ts: `getMe`, `updateDisplayName`
- src/app/api/profile/me/route.ts
- src/app/account/profile/page.tsx
- src/app/suspended/page.tsx
- src/lib/supabase/middleware.ts

**Test files (in scope):**
- src/lib/api/route-helpers.test.ts
- tests/services/profile.service.test.ts

## Out of Scope
- Phone verification (issue 009)
- Admin suspension actions (issue 045)

## Implementation Plan

Step 1: withRoute: parse + auth levels
Test 1: route-helpers.test.ts (Supabase auth mocked at the client factory) → `withRoute({ auth: 'user', body: z.object({ a: z.string() }).strict() })` with body `{ a: 1 }` → 422 `{ error: { code: 'VALIDATION_ERROR' } }`; no user → 401 UNAUTHENTICATED; user with `email_confirmed_at: null` → 403 EMAIL_NOT_VERIFIED; profile status suspended → 403 ACCOUNT_SUSPENDED
File:   src/lib/api/route-helpers.ts

Step 2: withRoute: Result mapping + 500
Test 2: handler returning `err({ code: 'SHOP_ALREADY_EXISTS', message: 'x' })` → 409 (status table from api-contracts); a handler that throws → 500 INTERNAL_ERROR with `requestId`, and `logger.error` is called once
File:   src/lib/api/route-helpers.ts

Step 3: profile.service getMe/updateDisplayName
Test 3: tests/services/profile.service.test.ts → `getMe(asUser(u))` returns `{ ok: true, value: { display_name: 'jo', role: 'user', phone: null, phone_verified: false, has_shop: false } }`; `updateDisplayName(db, '')` → `{ ok: false, error: { code: 'VALIDATION_ERROR' } }`
File:   src/services/profile.service.ts

Step 4: GET/PATCH /api/profile/me + profile page
Test 4: route test via withRoute: PATCH `{ display_name: 'Jo B', extra: 1 }` → 422; `{ display_name: 'Jo B' }` → 200 with display_name 'Jo B'
File:   src/app/api/profile/me/route.ts, src/app/account/profile/page.tsx

Step 5: Suspended redirect
Test 5: unit-test the `updateSession` decision function `shouldRedirectSuspended(pathname, status)`: ('/sell/x','suspended') → '/suspended'; ('/cars','suspended') → null; ('/sell','active') → null
File:   src/lib/supabase/middleware.ts, src/app/suspended/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- profile

### Manual verification
1. Signed in, open /account/profile, change the name to 'Jo Buyer', reload: it's persisted
2. In SQL, set your profile status = 'suspended', open /sell → you're redirected to /suspended; GET /api/profile/me → 403 ACCOUNT_SUSPENDED

## Git
- Branch: feature/005-profile-api-and-suspension
- Commit: feat(profile): add route helpers, profile API and suspended-account handling closes #005
- PR title: 005 Profile API, route helpers, profile page and suspended-account handling
