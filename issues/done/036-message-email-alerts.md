# Issue 036: New-message email alerts and message rate limit

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F02-seller-inbox-and-alerts
**Type:** AFK
**Status:** open
**Blocked by:** #035
**Priority:** normal
**Branch:** feature/036-message-email-alerts

## Goal
Recipients get an email for new messages, at most one per thread every 15 minutes, and senders are limited to 60 messages an hour.

## User Story
As a seller, I want an email when a buyer writes, so that I don't miss them, without being spammed.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: notifications (new_message throttle rule)
- docs/auth.md: Rate limits (messages 60/hour)
- docs/decisions.md: ADR-010

## Acceptance Criteria
- [x] `send_message` enqueues `new_message` for the recipient via enqueue_notification (throttled 15 min per conversation per recipient)
- [x] The email shows the sender's name, car title, first 200 chars of the message, and a link to the right inbox thread
- [x] The 61st message by a user within an hour → 429 RATE_LIMITED
- [x] Messages in a blocked conversation never enqueue emails

## Files to Modify
- supabase/migrations/20260928003600_message_alerts.sql: `send_message` (create or replace) with enqueue + hourly limit
- src/server/jobs/notification-dispatch/templates.ts: new_message
- src/services/messaging.service.ts: map RATE_LIMITED

**Test files (in scope):**
- tests/services/message-alerts.test.ts
- src/server/jobs/notification-dispatch/templates.test.ts

## Out of Scope
- Push/SMS notifications (out of scope)

## Implementation Plan

Step 1: Enqueue + throttle
Test 1: tests/services/message-alerts.test.ts → the buyer sends 3 messages within 1 minute → exactly 1 pending new_message for the owner; after moving created_at back 16 min, the next message → 2
File:   migration

Step 2: Hourly limit
Test 2: insert 60 messages by the user in the last hour via adminDb → the next sendMessage → RATE_LIMITED
File:   migration, messaging.service.ts

Step 3: Template
Test 3: `render('new_message', { senderName: 'Jo', title: '2019 Toyota HiLux', preview: 'x'.repeat(300), url })` text contains 200 x's followed by '…' and the url
File:   templates.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- message-alerts

### Manual verification
1. As a buyer send 3 quick messages → the dev log shows one 'New message about your 2019 Toyota HiLux' email to the seller

## Git
- Branch: feature/036-message-email-alerts
- Commit: feat(messaging): add throttled new-message emails and message rate limit closes #036
- PR title: 036 New-message email alerts and message rate limit
