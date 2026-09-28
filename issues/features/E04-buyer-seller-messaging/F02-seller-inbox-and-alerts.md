# E04-F02: Seller inbox and replies with email alerts

**Epic:** E04-buyer-seller-messaging
**Blocked by:** E04-F01
**PRD coverage:** AC-46

## User story
As a shop owner, I want to see buyer messages and reply, and get an email when a new message arrives, so that I don't miss buyers.

## Layers touched
Service: messaging.service (shop side, read receipts, 60/hour limit) · DB: new_message enqueue with 15-minute throttle · Jobs: new_message template · UI: `/sell/messages` inbox + thread, unread badge in the header

## Visible result (vertical slice test)
The seller sees an unread badge, opens the thread, replies; the buyer sees the reply. Three quick messages produce one email within 15 minutes.

## Rough issue list
1. Seller inbox + reply + unread counts
2. New-message email alerts with the 15-minute throttle + message rate limit

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
