# Issue 044: Reports queue for admins, and reporting conversations

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F03-reports-and-auto-hide
**Type:** AFK
**Status:** open
**Blocked by:** #043
**Priority:** normal
**Branch:** feature/044-reports-queue-and-conversation-reports

## Goal
Admins work through open reports (with the reported content in front of them, including reported conversations), and users can report a conversation from the thread view.

## User Story
As an admin, I want all reports in one queue with context, so that I can act consistently.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/admin/queues/reports, POST /api/admin/reports/:id/dismiss|action
- docs/schema.md: conversations/messages RLS (admin reads reported)
- CLAUDE.md: deep modules (moderation.service public API is capped at 8 exports: listQueue, decideShop, decideImage, decideListing, decideReport, setSuspension, setListingCap, listAuditLog)

### System specs
- docs/systems/listing-lifecycle.md: Error path (reports on a live listing)

## Acceptance Criteria
- [ ] `listQueue('reports')` groups open reports by target (count, reasons, notes, latest date), oldest first, with target context (listing title/status, shop name, or a conversation's last 20 messages)
- [ ] Admins can read the messages of a reported conversation only (RLS policy added here); non-reported conversations stay invisible to admins
- [ ] `decideReport(id, 'dismiss'|'action', reason)` closes every open report on that target with the resolution, writing audit rows
- [ ] Dismissing a listing's reports doesn't auto-restore it; the admin clears the reports_threshold flag (042) explicitly; the UI offers 'Dismiss & restore listing' doing both
- [ ] The ThreadView gets a 'Report conversation' action using ReportDialog

## Files to Modify
- supabase/migrations/20260928004400_reports_admin.sql: admin read policy for reported conversations/messages, `admin_decide_report`
- src/services/moderation.service.ts: `listQueue` reports branch, `decideReport`
- src/app/api/admin/reports/[id]/[action]/route.ts
- src/app/admin/reports/page.tsx
- src/components/messaging/ThreadView.tsx: Report conversation
- src/app/api/admin/queues/[queue]/route.ts: allow 'reports'

**Test files (in scope):**
- tests/services/moderation-reports.test.ts
- tests/rls/reported-conversations.test.ts

## Out of Scope
- Automatic suspension on repeated reports

## Implementation Plan

Step 1: Admin read of reported conversations
Test 1: tests/rls/reported-conversations.test.ts → the admin selects messages of an unreported conversation → 0 rows; after the buyer reports it → the rows are visible
File:   migration

Step 2: Reports queue
Test 2: tests/services/moderation-reports.test.ts → 3 reports on listing L + 1 on shop S → the queue has 2 items, L first (oldest), with count 3 and reasons ['scam','ai_or_fake_photos']
File:   moderation.service.ts

Step 3: decideReport
Test 3: dismiss L with reason 'Checked, legit' → all 3 reports dismissed with resolved_by = admin, 3 audit rows (action report.dismiss); the listing is still in_review until the flag is cleared
File:   migration, moderation.service.ts, route

Step 4: UI
Test 4: /admin/reports renders the grouped items; 'Dismiss & restore listing' calls dismiss then clear-flag; ThreadView shows a 'Report conversation' button opening ReportDialog with target_type 'conversation'
File:   page, ThreadView.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- moderation-reports reported-conversations

### Manual verification
1. Report a car 3 times → /admin/reports shows it with count 3 → Dismiss & restore → it's back in search
2. Report a conversation → as admin you can open its messages from the queue

## Git
- Branch: feature/044-reports-queue-and-conversation-reports
- Commit: feat(moderation): add admin reports queue and conversation reporting closes #044
- PR title: 044 Reports queue for admins, and reporting conversations
