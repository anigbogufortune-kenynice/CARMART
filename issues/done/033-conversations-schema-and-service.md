# Issue 033: Conversations and messages: schema, rules and API

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F01-message-a-shop
**Type:** AFK
**Status:** open
**Blocked by:** #022
**Priority:** high
**Branch:** feature/033-conversations-schema-and-service

## Goal
A signed-in buyer can start (or reopen) a text conversation with a shop about a live car, and both sides can read and send messages, with privacy enforced by RLS.

## User Story
As a buyer, I want to message a seller about a specific car, so that I can ask questions and arrange an inspection.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: conversations, messages
- docs/api-contracts.md: Conversations and messages
- docs/auth.md: Rate limits (new conversations)

## Acceptance Criteria
- [ ] `start_conversation(listing_id, body)`: the listing must be live (404 otherwise), the caller can't be the shop owner (403 OWN_LISTING), and it reuses the thread for the same (listing, buyer) (200) or creates one (201); new threads limited to daily_conversation_limit (20) per 24 h → 429 CONVERSATION_LIMIT
- [ ] Messages are text only, 1–2000 chars; the strict body rejects any extra key (no attachments)
- [ ] RLS: only the buyer and the shop owner can read a conversation and its messages; others get 0 rows
- [ ] GET /api/conversations lists threads (either role) with the listing title, other party name, last message, unread_count, newest first
- [ ] GET /api/conversations/:id/messages paginates (50, `before` cursor) and marks the recipient's messages read

## Files to Modify
- supabase/migrations/20260928003300_messaging.sql: tables, RLS, `start_conversation`, `send_message`, `mark_read`
- src/services/messaging.service.ts: `startConversation`, `listConversations`, `listMessages`, `sendMessage`
- src/app/api/conversations/route.ts: GET, POST
- src/app/api/conversations/[id]/messages/route.ts: GET, POST

**Test files (in scope):**
- tests/services/messaging.test.ts
- tests/rls/messaging.test.ts

## Out of Scope
- UI (034, 035)
- Email alerts (036)
- Blocking (038)
- Admin access to reported threads (044)

## Implementation Plan

Step 1: Tables + RLS
Test 1: tests/rls/messaging.test.ts → buyer and owner see the conversation; a third user and anon see 0 rows; a third user inserting a message → RLS error
File:   migration

Step 2: start_conversation rules
Test 2: tests/services/messaging.test.ts → on a draft listing → NOT_FOUND; the owner on their own listing → OWN_LISTING; the first call → created true; the second call → same conversation_id, created false, 2 messages
File:   migration, messaging.service.ts

Step 3: Daily limit
Test 3: after creating 20 conversations in 24 h (different listings), the 21st → CONVERSATION_LIMIT; a message in an existing thread is still allowed
File:   migration

Step 4: Send + validation
Test 4: sendMessage body '' → VALIDATION_ERROR; 2001 chars → VALIDATION_ERROR; the POST body `{ body: 'hi', attachment: 'x' }` → 422
File:   messaging.service.ts, route

Step 5: List + read
Test 5: the owner's listConversations shows unread_count 2; after owner listMessages → buyer messages have read_at set and unread_count 0
File:   messaging.service.ts, routes

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- messaging

### Manual verification
1. As a buyer, POST /api/conversations for a live listing → 201
2. Repeat → 200 with the same id
3. As another user, GET /api/conversations/<id>/messages → 404

## Git
- Branch: feature/033-conversations-schema-and-service
- Commit: feat(messaging): add conversations and messages with privacy rules closes #033
- PR title: 033 Conversations and messages: schema, rules and API
