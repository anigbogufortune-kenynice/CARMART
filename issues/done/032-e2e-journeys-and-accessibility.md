# Issue 032: End-to-end journeys and accessibility checks

> **Nigeria (ADR-015):** no postcode (state + city only), prices in naira (kobo), +234 mobiles, Nigerian plate numbers instead of "rego", `pickup` instead of `ute`, a required car condition, no PPSR (VIN shown for buyers to check), Nigerian law for legal pages. Where this file says otherwise, ADR-015 wins.

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F04-seo-a11y-legal
**Type:** AFK
**Status:** open
**Blocked by:** #031
**Priority:** normal
**Branch:** feature/032-e2e-journeys-and-accessibility

## Goal
Automated browser tests prove the core seller and buyer journeys work end to end, and core pages meet WCAG 2.1 AA with no serious axe violations at desktop and 360px widths.

## User Story
As the team, I want the main journeys and accessibility verified automatically, so that regressions are caught before release.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- issues/prd-carmart.md: Testing Strategy (E2E journeys, accessibility)
- docs/env.md: fake providers in tests, local test OTP

## Acceptance Criteria
- [x] e2e/seller-journey.spec.ts: sign up → verify email (Inbucket) → create shop → verify phone (test OTP) → submit → admin approves → create listing → upload 4 fixture photos → submit → the listing becomes Live
- [x] e2e/buyer-journey.spec.ts: search /cars with filters → open a listing → save it → it appears on /account/saved
- [x] e2e/a11y.spec.ts: axe (wcag2a, wcag2aa) on /, /cars, /cars/[id], /shops/[slug], /sign-up, /sell, at 1280px and 360px → 0 serious/critical violations
- [x] Any violation found that needs changes outside this issue's files is written to issues/discovered/ (with the failing selector) instead of being fixed here

## Files to Modify
- e2e/helpers.ts: signUpAndVerify, signInAs, createApprovedShop, uploadFixture
- e2e/seller-journey.spec.ts
- e2e/buyer-journey.spec.ts
- e2e/a11y.spec.ts

**Test files (in scope):**
- (this issue is the tests)

## Out of Scope
- Fixing violations in pages owned by other issues (log them in issues/discovered/)

## Implementation Plan

Step 1: Helpers
Test 1: `signUpAndVerify(page, 'seller@test.local')` completes within 20 s and leaves the page at '/' with the header showing the email
File:   e2e/helpers.ts

Step 2: Seller journey
Test 2: the final assertion: /sell/listings/<id> shows 'Live' within 30 s (polling), and /cars/<id> is reachable signed out
File:   e2e/seller-journey.spec.ts

Step 3: Buyer journey
Test 3: after filtering body_type=ute the first card title contains 'HiLux' (seed); after Save, /account/saved has 1 card
File:   e2e/buyer-journey.spec.ts

Step 4: Accessibility
Test 4: for each page × viewport: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()` → violations with impact serious|critical = []
File:   e2e/a11y.spec.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:e2e

### Manual verification
1. Run `npx playwright test --ui` and watch the seller journey complete
2. Open the HTML report (npx playwright show-report) → the a11y spec is green

## Git
- Branch: feature/032-e2e-journeys-and-accessibility
- Commit: feat(e2e): add end-to-end journeys and accessibility checks closes #032
- PR title: 032 End-to-end journeys and accessibility checks
