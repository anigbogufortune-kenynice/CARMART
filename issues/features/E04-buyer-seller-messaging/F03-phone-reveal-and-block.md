# E04-F03: Phone reveal and blocking a conversation

**Epic:** E04-buyer-seller-messaging
**Blocked by:** E04-F01
**PRD coverage:** AC-47, AC-48

## User story
As a buyer, I want to see the seller's phone if they allow it; as either party, I want to block a conversation, so that I control contact.

## Layers touched
Routes: `GET /api/listings/:id/phone`, `POST /api/conversations/:id/block` · UI: 'Show phone' button (signed-in only), show_phone toggle in /sell/shop, Block action in thread view

## Visible result (vertical slice test)
With show_phone on, a signed-in buyer taps 'Show phone' and sees +61…; visitors are asked to sign in; with it off the button is hidden. After blocking, the other side's send fails with CONVERSATION_BLOCKED.

## Rough issue list
1. Phone reveal route + shop toggle + button
2. Block conversation route + UI + send guard

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
