# E02: Car Listings with Verified Photos

**PRD:** issues/prd-carmart.md · **Stories:** 14–19 · **ACs:** AC-11 to AC-36 (except the admin-only parts in E05)
**Blocked by:** E01

## Summary
An approved shop can create a structured, car-only listing (make/model from the car list, required VIN), upload 4–20 photos, and watch each photo get checked live. The car check and the AI check run, and passed photos are cleaned of metadata and published. The listing goes live automatically when every photo passes. The seller can then edit it, add photos, mark it sold, and renew it when it expires. Rejected photos show the seller why.

## User value
The core promise of CarMart: only real cars, with only real, checked car photos.

## Features (titles only)
- F01 Create a car listing draft (car-only reference data, VIN, AU validation) in the seller dashboard
- F02 Photo upload with live verification status (signed uploads, HEIC conversion, job runner, decision table, publishing)
- F03 Submit a listing and go live (submit rules, cap, evaluate_listing, "listing live/rejected" emails)
- F04 Manage live listings (edit rules, add photos, mark sold, expiry + reminders, renew)

## Reference docs
docs/systems/listing-lifecycle.md · docs/systems/image-verification.md · docs/schema.md (vehicle_*, listings, listing_images, image_checks, upload_events) · docs/api-contracts.md (Listings, Listing photos, Internal) · docs/decisions.md (ADR-003, 004, 006, 007, 009, 011)

## Blocking relationships
Blocked by E01. Blocks E03, E04 and part of E05.
