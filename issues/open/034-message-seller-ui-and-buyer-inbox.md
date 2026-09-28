# Issue 034: 'Message seller' button and the buyer inbox

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F01-message-a-shop
**Type:** AFK
**Status:** open
**Blocked by:** #033, #030
**Priority:** high
**Branch:** feature/034-message-seller-ui-and-buyer-inbox

## Goal
Buyers message a shop from the car page and follow the conversation in /account/messages.

## User Story
As a buyer, I want to contact the seller from the car page and see replies in one place.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Conversations and messages
- docs/architecture.md: Page map (/account/messages)

## Acceptance Criteria
- [ ] /cars/[id] 'Message seller' opens a composer (prefilled 'Hi, is the 2019 Toyota HiLux still available?'); visitors are sent to /sign-in?next=…; hidden for the owner and on sold listings
- [ ] Sending creates or reopens the thread and navigates to /account/messages/[id]
- [ ] /account/messages lists threads with the listing thumbnail/title, last message preview, time and an unread dot
- [ ] The thread view shows messages oldest→newest, sender alignment, a composer with a 2000-char counter, and refreshes every 10 s while open
- [ ] Error messages: CONVERSATION_LIMIT → 'You've started a lot of conversations today — try again tomorrow'

## Files to Modify
- src/components/messaging/MessageSellerButton.tsx
- src/components/messaging/ThreadView.tsx
- src/app/account/messages/page.tsx
- src/app/account/messages/[id]/page.tsx
- src/app/cars/[id]/page.tsx: add MessageSellerButton

**Test files (in scope):**
- src/components/messaging/MessageSellerButton.test.tsx
- src/components/messaging/ThreadView.test.tsx

## Out of Scope
- The seller inbox (035)
- Block/report actions (038, 044)

## Implementation Plan

Step 1: MessageSellerButton
Test 1: signed out → the link /sign-in?next=%2Fcars%2F<id>; signed in → opens the composer with the prefilled text; the submit POSTs /api/conversations and routes to /account/messages/<conversation_id>
File:   MessageSellerButton.tsx

Step 2: Limit message
Test 2: a mocked 429 CONVERSATION_LIMIT response shows the friendly limit text
File:   MessageSellerButton.tsx

Step 3: ThreadView
Test 3: renders 3 messages in order; own messages are right-aligned; typing 2001 chars disables Send; polling calls GET messages every 10 s and stops on unmount
File:   ThreadView.tsx

Step 4: Pages
Test 4: /account/messages renders an unread dot for unread_count > 0; /account/messages/[id] renders ThreadView
File:   account/messages pages, src/app/cars/[id]/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test -- messaging

### Manual verification
1. As a buyer, open a car, click Message seller, send → you land in the thread
2. Click Message seller again → the same thread
3. As the owner of that listing, the button is hidden

## Git
- Branch: feature/034-message-seller-ui-and-buyer-inbox
- Commit: feat(messaging): add message-seller button and buyer inbox closes #034
- PR title: 034 'Message seller' button and the buyer inbox
