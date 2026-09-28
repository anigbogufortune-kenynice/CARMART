# E04: Buyer–Seller Messaging

**PRD:** issues/prd-carmart.md · **Stories:** 6, 7, 10, 19 (message email), 20 · **ACs:** AC-42 to AC-48
**Blocked by:** E03

## Summary
A signed-in buyer can message a shop about a specific car, text only, with one thread per buyer and listing. The seller replies from their inbox. Both get throttled email alerts. Buyers can reveal the seller's phone if the shop has allowed it, and either side can block a conversation. Limits stop spam (20 new threads per day per buyer, 60 messages per hour).

## User value
Buyers and sellers connect safely without exposing personal contact details by default.

## Features (titles only)
- F01 Message a shop about a car (start/reopen thread, buyer inbox, limits)
- F02 Seller inbox and replies with email alerts
- F03 Phone reveal and blocking a conversation

## Reference docs
docs/api-contracts.md (Conversations and messages, listing phone) · docs/schema.md (conversations, messages, notifications) · docs/auth.md (rate limits)

## Blocking relationships
Blocked by E03. Blocks E05 F03 (reporting conversations).
