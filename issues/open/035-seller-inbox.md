# Issue 035: Seller inbox and replies

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F02-seller-inbox-and-alerts
**Type:** AFK
**Status:** open
**Blocked by:** #034
**Priority:** high
**Branch:** feature/035-seller-inbox

## Goal
Shop owners see all buyer conversations in /sell/messages and reply, with an unread badge in the header.

## User Story
As a shop owner, I want one inbox for buyer questions, so that I reply quickly and sell faster.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/conversations (shop side), messages routes
- docs/architecture.md: Page map (/sell/messages)

## Acceptance Criteria
- [ ] /sell/messages lists conversations for the owner's shop (buyer display name, car title, preview, unread dot), newest activity first
- [ ] /sell/messages/[id] reuses ThreadView; replying works; opening marks the buyer's messages read
- [ ] The header shows an unread count badge (buyer + seller threads combined) linking to the right inbox; the count comes from one `unreadCount` query
- [ ] An owner without a shop sees a prompt to create one

## Files to Modify
- src/services/messaging.service.ts: `unreadCount`
- src/app/sell/messages/page.tsx
- src/app/sell/messages/[id]/page.tsx
- src/components/layout/SiteHeader.tsx: unread badge

**Test files (in scope):**
- tests/services/messaging-unread.test.ts
- src/components/layout/SiteHeader.test.tsx

## Out of Scope
- Email alerts (036)

## Implementation Plan

Step 1: unreadCount
Test 1: tests/services/messaging-unread.test.ts → the buyer sends 3 messages → `unreadCount(ownerDb)` = 3; after the owner opens the thread → 0
File:   messaging.service.ts

Step 2: Seller pages
Test 2: /sell/messages renders the buyer's display name 'Jo' and the car title; the thread page renders ThreadView with the reply box
File:   sell/messages pages

Step 3: Header badge
Test 3: SiteHeader.test.tsx → unread 4 renders a badge '4' with aria-label '4 unread messages'; 0 renders none
File:   SiteHeader.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- messaging-unread

### Manual verification
1. As the buyer send 2 messages; as the seller the header shows 2; open /sell/messages → reply → the buyer sees the reply in /account/messages

## Git
- Branch: feature/035-seller-inbox
- Commit: feat(messaging): add seller inbox and unread badge closes #035
- PR title: 035 Seller inbox and replies
