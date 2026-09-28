# Issue 043: Report a listing or shop, and auto-hide at 3 reports

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F03-reports-and-auto-hide
**Type:** AFK
**Status:** open
**Blocked by:** #042, #038
**Priority:** high
**Branch:** feature/043-reports-and-auto-hide

## Goal
Signed-in users can report suspicious listings and shops; a listing with 3 open reports from different users is hidden automatically until an admin looks.

## User Story
As a buyer, I want to flag a suspicious car, so that CarMart can act quickly.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: reports, app_settings (reports_auto_hide_count, daily_report_limit)
- docs/api-contracts.md: POST /api/reports

### System specs
- docs/systems/listing-lifecycle.md: transition report_threshold (live → in_review, flag reports_threshold), EC-L10

## Acceptance Criteria
- [ ] `create_report(target_type, target_id, reason, note)`: the target must be visible to the reporter (conversation: participant only); one open report per user per target (409 ALREADY_REPORTED); 10 per 24 h (429 REPORT_LIMIT)
- [ ] When a live listing reaches reports_auto_hide_count (3) open reports from distinct users → in_review with flag reports_threshold (leaves search)
- [ ] Sold listings can be reported but aren't auto-hidden
- [ ] A 'Report' dialog (reason radio list + optional note ≤ 1000) on /cars/[id] and /shops/[slug]; visitors are asked to sign in; success → 'Thanks — our team will review this'
- [ ] `report.service.ts` holds createReport (keeps moderation.service within 8 exports)

## Files to Modify
- supabase/migrations/20260928004300_reports.sql: enums, table, RLS, `create_report`
- src/services/report.service.ts: `createReport`
- src/app/api/reports/route.ts
- src/components/moderation/ReportDialog.tsx
- src/app/cars/[id]/page.tsx: Report button
- src/app/shops/[slug]/page.tsx: Report button

**Test files (in scope):**
- tests/services/reports.test.ts
- src/components/moderation/ReportDialog.test.tsx

## Out of Scope
- The reports queue (044)
- Reporting conversations from the thread view (044)

## Implementation Plan

Step 1: create_report rules
Test 1: tests/services/reports.test.ts → reporting a draft listing → NOT_FOUND; the same user twice → ALREADY_REPORTED; the 11th report in a day → REPORT_LIMIT; a non-participant reporting a conversation → NOT_FOUND
File:   migration, report.service.ts

Step 2: Auto-hide
Test 2: 3 different users report a live listing → status in_review, review_flags contains reports_threshold, and searchListings no longer returns it; 3 reports on a sold listing → still sold
File:   migration

Step 3: Route
Test 3: POST `{ target_type: 'listing', target_id, reason: 'scam' }` → 201; reason 'boring' → 422
File:   src/app/api/reports/route.ts

Step 4: ReportDialog + buttons
Test 4: ReportDialog.test.tsx → submit is disabled until a reason is chosen; success shows the thanks message; the 409 shows 'You've already reported this'
File:   ReportDialog.tsx, cars page, shop page

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- live --report_threshold--> in_review with flag reports_threshold when open reports from distinct users ≥ reports_auto_hide_count
- EC-L10: sold listings are reportable but never auto-hidden

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- reports

### Manual verification
1. As 3 different users report the same car → it disappears from /cars
2. Report twice as the same user → 'You've already reported this'

## Git
- Branch: feature/043-reports-and-auto-hide
- Commit: feat(moderation): add reporting with automatic hiding at three reports closes #043
- PR title: 043 Report a listing or shop, and auto-hide at 3 reports
