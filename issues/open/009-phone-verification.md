# Issue 009: Verify my Australian mobile by SMS code

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F03-phone-verification-and-submit
**Type:** AFK
**Status:** open
**Blocked by:** #008
**Priority:** high
**Branch:** feature/009-phone-verification

## Goal
A shop owner verifies an Australian mobile with a 6-digit SMS code, and the checklist marks step 2 done.

## User Story
As a shop owner, I want to verify my mobile, so that I can submit my shop for approval.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/auth.md: Phone verification (sellers only), Rate limits
- docs/api-contracts.md: POST /api/profile/phone/send-code, /verify
- docs/schema.md: profiles.phone, phone_verified_at
- docs/env.md: Supabase Auth configuration (test OTP)

### System specs
- docs/systems/shop-onboarding.md: EC-S1, EC-S2

## Acceptance Criteria
- [ ] send-code accepts only `+614XXXXXXXX` (422 INVALID_AU_MOBILE otherwise) and calls `auth.updateUser({ phone })`
- [ ] A number already verified on another profile → 409 PHONE_IN_USE (no SMS sent)
- [ ] More than 5 codes per user per hour → 429 RATE_LIMITED
- [ ] verify with the right code sets `profiles.phone` + `phone_verified_at` (trigger from auth.users.phone_confirmed_at); a wrong code → 422 INVALID_CODE
- [ ] /sell/phone has a two-step form (number → code) and a 'Resend code' link after 60 s

## Files to Modify
- supabase/migrations/20260928000900_phone_verification.sql: trigger syncing auth.users.phone/phone_confirmed_at → profiles; `phone_in_use(phone)` function; `phone_code_requests` counter table + RLS
- src/services/profile.service.ts: `sendPhoneCode`, `verifyPhoneCode`
- src/app/api/profile/phone/send-code/route.ts
- src/app/api/profile/phone/verify/route.ts
- src/app/sell/phone/page.tsx
- src/types/domain.ts: AuMobileSchema

**Test files (in scope):**
- tests/services/phone.test.ts
- src/app/sell/phone/page.test.tsx

## Out of Scope
- Using the phone for sign-in
- Twilio production config (launch checklist)

## Implementation Plan

Step 1: AU mobile schema
Test 1: `AuMobileSchema.safeParse('+61412345678').success` true; '0412345678' false; '+61212345678' false (landline)
File:   src/types/domain.ts

Step 2: Sync trigger + phone_in_use
Test 2: tests/services/phone.test.ts → after `verifyOtp({ phone: '+61400000000', token: '123456', type: 'phone_change' })` (local test OTP), the profile has phone '+61400000000' and phone_verified_at not null; `phone_in_use('+61400000000')` true for another user
File:   migration

Step 3: sendPhoneCode
Test 3: a second user sending '+61400000000' → PHONE_IN_USE and `updateUser` isn't called; a sixth request within an hour → RATE_LIMITED
File:   src/services/profile.service.ts

Step 4: verifyPhoneCode
Test 4: code '000000' → INVALID_CODE; '123456' → ok `{ phone_verified: true }`
File:   src/services/profile.service.ts, routes

Step 5: /sell/phone UI
Test 5: page.test.tsx → entering '0412 345 678' is normalised to '+61412345678' before sending; after send, the code field appears; 'Resend code' is disabled for 60 s
File:   src/app/sell/phone/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- EC-S1: a phone verified on another account → 409 PHONE_IN_USE
- EC-S2: changing the phone after approval keeps the shop approved; phone_verified_at updates only after the new code verifies

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- phone

### Manual verification
1. Open /sell/phone, enter 0400 000 000, then code 123456 (local test OTP) → 'Phone verified' and the /sell checklist step 2 is done
2. Enter a wrong code → 'That code isn't right'

## Git
- Branch: feature/009-phone-verification
- Commit: feat(profile): add Australian mobile verification by SMS code closes #009
- PR title: 009 Verify my Australian mobile by SMS code
