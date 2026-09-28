# Issue 031: Legal and trust pages

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F04-seo-a11y-legal
**Type:** AFK
**Status:** open
**Blocked by:** #030
**Priority:** normal
**Branch:** feature/031-legal-and-trust-pages

## Goal
CarMart publishes clear Terms, Privacy, Prohibited Listings, Buyer Safety and Contact pages (draft wording, flagged for lawyer review).

## User Story
As a buyer or seller, I want to understand the rules and how to stay safe, so that I trust CarMart.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/auth.md: Privacy (Australian Privacy Act)
- docs/decisions.md: ADR-001, ADR-003
- issues/prd-carmart.md: Out of Scope, Implementation Decisions
- docs/architecture.md: Launch checklist (lawyer review)

## Acceptance Criteria
- [ ] Each page is static, server-rendered, with a heading hierarchy and a 'Last updated' date, and uses NEXT_PUBLIC_SUPPORT_EMAIL
- [ ] Every page shows a visible banner in non-production environments: 'Draft — pending legal review'
- [ ] Prohibited Listings says explicitly: cars only (the list of allowed body types); no trucks, buses, motorbikes, caravans, boats, parts; only real photos of the actual car; AI-generated or stock images are prohibited and may lead to removal or suspension
- [ ] Buyer Safety: inspect before paying, run the VIN on PPSR, never pay deposits to unverified parties or off-platform strangers, how to report
- [ ] Privacy: what's collected (account, phone for sellers, messages, photos), metadata stripped from photos, data hosted in Australia, access/deletion requests via the support email
- [ ] Terms: CarMart is a listing platform and isn't a party to sales (ADR-001); how photo checks work and that they aren't a guarantee (ADR-003)

## Files to Modify
- src/app/(legal)/terms/page.tsx
- src/app/(legal)/privacy/page.tsx
- src/app/(legal)/prohibited-listings/page.tsx
- src/app/(legal)/buyer-safety/page.tsx
- src/app/(legal)/contact/page.tsx
- src/app/(legal)/layout.tsx: shared prose layout + draft banner

**Test files (in scope):**
- src/app/(legal)/legal-pages.test.tsx

## Out of Scope
- A contact form (email link only in v1)
- The final legal wording (human task)

## Implementation Plan

Step 1: Legal layout + draft banner
Test 1: legal-pages.test.tsx → with NODE_ENV test/dev the banner 'Draft — pending legal review' renders; the h1 renders once per page
File:   src/app/(legal)/layout.tsx

Step 2: Prohibited Listings
Test 2: the page text includes 'ute', 'people mover', 'motorbikes', 'AI-generated'
File:   prohibited-listings/page.tsx

Step 3: Buyer Safety + PPSR
Test 3: contains a link to https://www.ppsr.gov.au/ and the phrase 'inspect the car before you pay'
File:   buyer-safety/page.tsx

Step 4: Privacy, Terms, Contact
Test 4: Privacy contains 'stored in Australia' and the support email; Terms contains 'not a party to any sale'; Contact renders a mailto link to NEXT_PUBLIC_SUPPORT_EMAIL
File:   privacy, terms, contact pages

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test -- legal-pages

### Manual verification
1. Open each footer link → the page renders with the draft banner
2. Check the wording against the PRD decisions (cars only, no money handling, photo checks)

## Git
- Branch: feature/031-legal-and-trust-pages
- Commit: feat(legal): add legal and trust pages closes #031
- PR title: 031 Legal and trust pages
