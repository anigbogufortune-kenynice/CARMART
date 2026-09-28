# Issue 003: Supabase clients, session middleware and the sign-up flow

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** #002
**Priority:** high
**Branch:** feature/003-supabase-clients-and-sign-up

## Goal
A visitor can sign up with email and password, receive a verification email (Inbucket locally), click it and land signed in.

## User Story
As a visitor, I want to create an account, so that I can use CarMart's member features.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/auth.md: Authentication method, Flows (Sign up), Authorisation layers
- docs/api-contracts.md: GET /auth/callback
- docs/architecture.md: Page map (auth routes)

## Acceptance Criteria
- [ ] `/sign-up` form (display name, email, password ≥ 10 chars) calls `supabase.auth.signUp` with emailRedirectTo `/auth/callback?next=/`
- [ ] Client-side validation shows field errors and never submits an invalid form; the server error 'User already registered' is shown as 'An account with this email already exists'
- [ ] `/auth/callback` exchanges the code for a session cookie and redirects to `next` only if it's a relative path starting with `/` (else `/`)
- [ ] Middleware refreshes the session on every request (matcher excludes static assets and `/api/internal`)

## Files to Modify
- src/lib/supabase/server.ts: `createServerSupabase()` (cookies, anon key)
- src/lib/supabase/client.ts: `createBrowserSupabase()`
- src/lib/supabase/middleware.ts: `updateSession(request)`
- src/middleware.ts
- src/app/auth/callback/route.ts
- src/app/(auth)/sign-up/page.tsx

**Test files (in scope):**
- src/app/auth/callback/route.test.ts
- src/app/(auth)/sign-up/page.test.tsx
- e2e/sign-up.spec.ts

## Out of Scope
- Sign-in, reset and verify-email pages (issue 004)
- Profiles API (issue 005)

## Implementation Plan

Step 1: Safe redirect helper inside callback route
Test 1: route.test.ts → `safeNext('/sell')` → '/sell'; `safeNext('https://evil.com')` → '/'; `safeNext('//evil.com')` → '/'; `safeNext(null)` → '/'
File:   src/app/auth/callback/route.ts

Step 2: Callback exchanges the code
Test 2: route.test.ts (Supabase auth client is external → mocked at the `@supabase/ssr` boundary): GET `/auth/callback?code=abc&next=/sell` calls `exchangeCodeForSession('abc')` and returns 307 to `/sell`; missing code → 307 to `/sign-in?error=link_invalid`
File:   src/app/auth/callback/route.ts

Step 3: Server/browser clients + middleware session refresh
Test 3: src/lib/supabase/middleware.ts exported `updateSession` returns a NextResponse and preserves `Set-Cookie` from the Supabase client; matcher config excludes `/_next/static`, images and `/api/internal`
File:   src/lib/supabase/*.ts, src/middleware.ts

Step 4: Sign-up form
Test 4: page.test.tsx → submitting with password 'short' shows 'Password must be at least 10 characters' and does not call signUp; valid input calls `signUp({ email, password, options: { data: { display_name }, emailRedirectTo: <origin>/auth/callback?next=/ } })` and shows 'Check your email to verify your account'
File:   src/app/(auth)/sign-up/page.tsx

Step 5: End-to-end sign-up with Inbucket
Test 5: e2e/sign-up.spec.ts → fill the form, fetch the latest Inbucket message (http://127.0.0.1:54324/api/v1/mailbox/<local>), follow the link, expect the URL `/` and a session cookie present
File:   e2e/sign-up.spec.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test (callback, sign-up form) && npm run test:e2e -- sign-up

### Manual verification
1. Open http://localhost:3000/sign-up, sign up as test@carmart.local
2. Open Inbucket http://127.0.0.1:54324, click the confirmation link, then land on / signed in (session cookie `sb-…-auth-token` present)

## Git
- Branch: feature/003-supabase-clients-and-sign-up
- Commit: feat(auth): add Supabase clients, session middleware and sign-up flow closes #003
- PR title: 003 Supabase clients, session middleware and the sign-up flow
