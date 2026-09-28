# Issue 038: Block a conversation

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F03-phone-reveal-and-block
**Type:** AFK
**Status:** open
**Blocked by:** #037
**Priority:** normal
**Branch:** feature/038-block-conversation

## Goal
Either participant can block a conversation, after which the other side can't send messages in it.

## User Story
As a buyer or seller, I want to stop unwanted messages in a thread, so that I feel safe.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: POST /api/conversations/:id/block
- docs/schema.md: conversations.blocked_by, messages INSERT policy

## Acceptance Criteria
- [ ] POST /api/conversations/:id/block (participant only) sets blocked_by = caller → 204; a non-participant → 404
- [ ] Afterwards the *other* participant's send → 403 CONVERSATION_BLOCKED; the blocker can still read the thread (but can't send either, to avoid one-sided harassment)
- [ ] Starting a new conversation on the same listing by the blocked buyer → 403 CONVERSATION_BLOCKED
- [ ] The thread view shows 'This conversation is blocked' and hides the composer; Block has a confirmation dialog

## Files to Modify
- supabase/migrations/20260928003800_block_conversation.sql: `block_conversation`, a send_message guard, start_conversation guard
- src/services/messaging.service.ts: `blockConversation`
- src/app/api/conversations/[id]/block/route.ts
- src/components/messaging/ThreadView.tsx: blocked state + Block action

**Test files (in scope):**
- tests/services/messaging-block.test.ts
- src/components/messaging/ThreadView.test.tsx

## Out of Scope
- Unblocking (admins can clear via SQL in v1)
- Reporting a conversation (044)

## Implementation Plan

Step 1: block_conversation
Test 1: tests/services/messaging-block.test.ts → the owner blocks → blocked_by = owner; a third user → NOT_FOUND
File:   migration, messaging.service.ts, route

Step 2: Send + start guards
Test 2: after the block, buyer sendMessage → CONVERSATION_BLOCKED; owner sendMessage → CONVERSATION_BLOCKED; buyer startConversation on the same listing → CONVERSATION_BLOCKED
File:   migration

Step 3: UI
Test 3: ThreadView with `blocked_by` set renders 'This conversation is blocked' and no textarea; Block → confirm → POST
File:   ThreadView.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- messaging-block

### Manual verification
1. As the seller, block a thread → the composer disappears
2. As the buyer, try to send → 'This conversation is blocked'

## Git
- Branch: feature/038-block-conversation
- Commit: feat(messaging): add conversation blocking closes #038
- PR title: 038 Block a conversation
