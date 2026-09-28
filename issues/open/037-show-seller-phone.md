# Issue 037: Show seller phone to signed-in buyers (opt-in)

**Epic:** E04-buyer-seller-messaging
**Feature:** E04-buyer-seller-messaging/F03-phone-reveal-and-block
**Type:** AFK
**Status:** open
**Blocked by:** #036
**Priority:** normal
**Branch:** feature/037-show-seller-phone

## Goal
Shops can opt in to showing their verified phone, and signed-in buyers can reveal it on the car page.

## User Story
As a buyer, I want to call the seller if they allow it; as a seller, I want control over who sees my number.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/listings/:id/phone, PATCH /api/shops/me (show_phone)
- docs/auth.md: Privacy (phone only on opt-in, signed-in)

## Acceptance Criteria
- [ ] GET /api/listings/:id/phone: signed in only (401), the listing publicly visible, the shop show_phone = true and the owner phone verified → `{ phone }`; else 404 PHONE_NOT_AVAILABLE
- [ ] /cars/[id] shows 'Show phone' only when the shop allows it; visitors are prompted to sign in; the revealed number is a tel: link
- [ ] /sell/shop has a 'Show my phone number to signed-in buyers' toggle (off by default)

## Files to Modify
- src/services/messaging.service.ts: `getShopPhone`
- src/app/api/listings/[id]/phone/route.ts
- src/components/listing/ShowPhoneButton.tsx
- src/app/cars/[id]/page.tsx
- src/components/shop/ShopForm.tsx: show_phone toggle

**Test files (in scope):**
- tests/services/shop-phone.test.ts
- src/components/listing/ShowPhoneButton.test.tsx

## Out of Scope
- Call tracking or masking (out of scope)

## Implementation Plan

Step 1: getShopPhone rules
Test 1: tests/services/shop-phone.test.ts → show_phone false → PHONE_NOT_AVAILABLE; true + live → '+61400000000'; a draft listing → PHONE_NOT_AVAILABLE
File:   messaging.service.ts

Step 2: Route
Test 2: anon → 401; signed in → 200 or 404 as above
File:   route

Step 3: Button + toggle
Test 3: ShowPhoneButton.test.tsx → click fetches and renders `<a href="tel:+61400000000">`; the ShopForm toggle PATCHes `{ show_phone: true }`
File:   ShowPhoneButton.tsx, ShopForm.tsx, cars page

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- shop-phone

### Manual verification
1. Enable the toggle in /sell/shop; as a signed-in buyer open the car → Show phone → the number appears
2. Signed out → 'Sign in to see the phone number'

## Git
- Branch: feature/037-show-seller-phone
- Commit: feat(messaging): add opt-in seller phone reveal closes #037
- PR title: 037 Show seller phone to signed-in buyers (opt-in)
