# Issue 004: Sign in, sign out, password reset and the site header

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F01-sign-up-sign-in
**Type:** AFK
**Status:** open
**Blocked by:** #003
**Priority:** high
**Branch:** feature/004-sign-in-reset-header

## Goal
Users can sign in (email or Google), sign out, reset a forgotten password, and always see who they are in the header.

## User Story
As a member, I want to sign in and out and recover my password, so that I can access my account safely.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/auth.md: Flows (Sign in, Sign out, Password reset)
- docs/architecture.md: Page map

## Acceptance Criteria
- [ ] `/sign-in` supports email + password and a 'Continue with Google' button (`signInWithOAuth`, redirectTo `/auth/callback?next=<next>`)
- [ ] Wrong credentials show 'Email or password is incorrect' (never which one)
- [ ] `/verify-email` explains that verification is required and offers 'Resend email' (`auth.resend({ type: 'signup' })`)
- [ ] `/auth/reset` has two modes: request link (email) and set new password (after following the link)
- [ ] The header shows 'Sign in' for visitors and the user's email with a 'Sign out' button for members; it's rendered in the root layout

## Files to Modify
- src/components/auth/AuthForm.tsx: shared email/password form (mode: sign-in)
- src/app/(auth)/sign-in/page.tsx
- src/app/(auth)/verify-email/page.tsx
- src/app/auth/reset/page.tsx
- src/components/layout/SiteHeader.tsx
- src/app/layout.tsx

**Test files (in scope):**
- src/components/auth/AuthForm.test.tsx
- src/components/layout/SiteHeader.test.tsx
- e2e/sign-in.spec.ts

## Out of Scope
- Display-name editing (issue 005)
- Suspended redirect (issue 005)

## Implementation Plan

Step 1: AuthForm sign-in mode
Test 1: AuthForm.test.tsx → with signInWithPassword resolving `{ error: { message: 'Invalid login credentials' } }`, the form shows 'Email or password is incorrect'; on success it calls `router.push(next ?? '/')`
File:   src/components/auth/AuthForm.tsx, src/app/(auth)/sign-in/page.tsx

Step 2: Google button
Test 2: AuthForm.test.tsx → clicking 'Continue with Google' calls `signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback?next=%2Fsell' } })` when next='/sell'
File:   src/components/auth/AuthForm.tsx

Step 3: Verify-email + resend
Test 3: render /verify-email with `?email=a@b.au` → clicking 'Resend email' calls `auth.resend({ type: 'signup', email: 'a@b.au' })` and shows 'Email sent'
File:   src/app/(auth)/verify-email/page.tsx

Step 4: Password reset both modes
Test 4: request mode calls `resetPasswordForEmail(email, { redirectTo: "<origin>/auth/callback?next=/auth/reset" })` (PKCE: the link must be exchanged by the callback); update mode (a session exists after the link) calls `updateUser({ password })` and rejects passwords < 10 chars
File:   src/app/auth/reset/page.tsx

Step 5: Header + layout
Test 5: SiteHeader.test.tsx → given `user = null` renders a link 'Sign in' to /sign-in; given `{ email: 'jo@x.au' }` renders 'jo@x.au' and a 'Sign out' button that calls `auth.signOut()`
File:   src/components/layout/SiteHeader.tsx, src/app/layout.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:e2e -- sign-in

### Manual verification
1. Sign in with the user from issue 003 → the header shows the email
2. Sign out → the header shows 'Sign in'
3. Request a reset for that email, open the Inbucket link, set a new password, sign in with it

## Git
- Branch: feature/004-sign-in-reset-header
- Commit: feat(auth): add sign-in, sign-out, password reset and site header closes #004
- PR title: 004 Sign in, sign out, password reset and the site header
