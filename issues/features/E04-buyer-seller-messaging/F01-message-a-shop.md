# E04-F01: Message a shop about a car

**Epic:** E04-buyer-seller-messaging
**Blocked by:** E03-F02
**PRD coverage:** AC-42, AC-43, AC-44, AC-45

## User story
As a signed-in buyer, I want to message the shop about a specific car, so that I can ask questions and arrange an inspection.

## Layers touched
DB: `conversations`, `messages` + RLS, `start_conversation` RPC (limit, live only, not own listing) · Service: messaging.service · Routes: `POST /api/conversations`, `GET /api/conversations`, `GET/POST /api/conversations/:id/messages` · UI: 'Message seller' on /cars/[id], `/account/messages` inbox + thread view

## Visible result (vertical slice test)
A buyer messages about a HiLux, sees the thread in /account/messages; a second 'Message seller' reopens the same thread; the 21st new thread in a day is refused.

## Rough issue list
1. conversations/messages migration + RLS + start_conversation RPC + messaging.service
2. Conversation routes + Message-seller button + buyer inbox and thread UI

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
