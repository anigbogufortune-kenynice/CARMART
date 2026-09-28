# E05: Trust and Moderation

**PRD:** issues/prd-carmart.md · **Stories:** 9, 22–29 · **ACs:** AC-14 (admin side), AC-23/24 (review side), AC-28, AC-31 (admin side), AC-37, AC-38, AC-49 to AC-52
**Blocked by:** E02 (photo and listing review); E04 for the conversation reports only

## Summary
Admins get the tools to keep CarMart honest:
- an image review queue (the photo, both vendor results, metadata signals and pHash matches) with approve/reject
- duplicate-VIN review with both listings side by side
- "Other" make/model review
- user reports with automatic hiding after 3 reports
- listing removal, suspension of shops and users, and per-shop listing caps
- live threshold settings and the full audit log

## User value
The human half of "no AI images, cars only". Uncertain cases get a person's judgement, and bad actors get removed.

## Features (titles only)
- F01 Image review queue (approve/reject uncertain photos)
- F02 Listing review: duplicate VINs, "Other" make/model, reject and remove
- F03 Reports and auto-hide (report button for listings, shops and conversations; reports queue)
- F04 Suspensions, listing caps, settings and audit log

## Reference docs
docs/systems/image-verification.md (admin path) · docs/systems/listing-lifecycle.md (flags, removal) · docs/systems/shop-onboarding.md (suspension) · docs/api-contracts.md (Admin, Reports) · docs/schema.md (reports, admin_actions, app_settings)

## Blocking relationships
Blocked by E02 (F01, F02, F04) and E04 (F03's conversation reports).
