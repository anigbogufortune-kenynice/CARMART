# Issue 025: Listing expiry, reminder emails and renewal

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F04-manage-live-listings
**Type:** AFK
**Status:** open
**Blocked by:** #024
**Priority:** normal
**Branch:** feature/025-expiry-reminders-and-renew

## Goal
Live listings expire after 60 days (with a reminder 7 days before), and owners can renew them, which re-checks the photos.

## User Story
As a shop owner, I want a reminder before my listing expires and an easy renew button.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/listings/:id/renew
- docs/schema.md: listings.expires_at/expiry_reminder_sent_at, Scheduled jobs (expire_listings, queue_expiry_reminders)

### System specs
- docs/systems/listing-lifecycle.md: expire + renew transitions, Evaluate rule 4 (expires_at), EC-L6, EC-L7

## Acceptance Criteria
- [x] `expire_listings()` (every 15 min) moves live listings with expires_at < now to expired; in_review listings never expire
- [x] `queue_expiry_reminders()` (hourly) enqueues one `listing_expiring` per live period for listings expiring within 7 days and sets expiry_reminder_sent_at
- [x] `renew_listing(id, version)` expired → checking; re-queues checks for all non-deleted photos; re-checks the cap (LISTING_LIMIT_REACHED) and VIN duplicates; on going live, expires_at = now + 60 d and the reminder flag is reset
- [x] The seller banner shows 'Expires on <date>' for live and a Renew button for expired; the listing_expiring template links to the listing

## Files to Modify
- supabase/migrations/20260928002500_expiry_and_renew.sql: functions + pg_cron schedules
- src/services/listing.service.ts: `renewListing`
- src/app/api/listings/[id]/renew/route.ts
- src/server/jobs/notification-dispatch/templates.ts: listing_expiring
- src/components/listing/ListingStatusBanner.tsx: expiry date + Renew

**Test files (in scope):**
- tests/services/listing-expiry.test.ts

## Out of Scope
- Paid 'boost' or auto-renew (out of scope for v1)

## Implementation Plan

Step 1: expire_listings
Test 1: tests/services/listing-expiry.test.ts → a live listing with expires_at = now − 1 min → after `select expire_listings()` → expired; an in_review listing with a past expires_at → unchanged
File:   migration

Step 2: Reminders
Test 2: a live listing with expires_at = now + 6 days → `select queue_expiry_reminders()` enqueues 1 listing_expiring; running again → still 1
File:   migration

Step 3: renew_listing
Test 3: expired listing with 4 passed photos → `renewListing(db, id, version)` → checking and 4 queued jobs; after processing (fake) → live with a new expires_at ≈ now + 60 d and expiry_reminder_sent_at null; with the shop at the cap → LISTING_LIMIT_REACHED
File:   migration, listing.service.ts, route

Step 4: Banner
Test 4: status live renders 'Expires on 27 Nov 2026'; status expired renders a 'Renew listing' button
File:   ListingStatusBanner.tsx, templates.ts

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/listing-lifecycle.md:**
- live --expire--> expired by the scheduler only
- expired --renew--> checking, re-running submit guards (cap, VIN) and re-checking all photos
- EC-L6: in_review listings don't expire; EC-L7: renew blocked at the cap

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- listing-expiry

### Manual verification
1. Set a live listing's expires_at to now + 5 days, run `select queue_expiry_reminders();` → the reminder email appears in the dev log
2. Set expires_at to the past, run `select expire_listings();` → the seller page shows Expired + Renew; click Renew → Checking → Live

## Git
- Branch: feature/025-expiry-reminders-and-renew
- Commit: feat(listings): add listing expiry, reminders and renewal closes #025
- PR title: 025 Listing expiry, reminder emails and renewal
