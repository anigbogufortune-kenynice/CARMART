# E01: Verified Seller Shops

**PRD:** issues/prd-carmart.md · **Stories:** 5, 11–13, 21 · **ACs:** AC-01 to AC-10, AC-52 (shop part), AC-53 (for its tables)
**Blocked by:** nothing (first epic; it carries the tracer-bullet foundation)

## Summary
A person can create an account, open their one shop, verify their Australian mobile, and submit the shop. An admin approves it, and the shop's public page goes live with a "Verified shop" badge. This epic also lays the foundations every later epic reuses:
- the Supabase clients and middleware
- env validation and the logger
- the `profiles`, `shops`, `admin_actions`, `app_settings` and `notifications` tables with RLS
- the email outbox and dispatcher
- the admin area shell

## User value
Sellers get a trustworthy storefront; buyers only ever see shops that a person has checked.

## Features (titles only)
- F01 Sign up, sign in and account basics (email + Google, email verification, suspended screen)
- F02 Create and edit my shop (draft) + public shop page
- F03 Phone verification and submitting a shop for approval
- F04 Admin shop approval queue with audit log and emails

## Reference docs
docs/auth.md · docs/schema.md (profiles, shops, admin_actions, app_settings, notifications) · docs/systems/shop-onboarding.md · docs/api-contracts.md (Auth and profile, Shops, Admin shops) · docs/architecture.md (job runner, outbox)

## Blocking relationships
Blocks E02, E03, E04, E05.
