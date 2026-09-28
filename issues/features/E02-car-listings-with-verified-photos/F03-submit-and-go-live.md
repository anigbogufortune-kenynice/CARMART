# E02-F03: Submit a listing and go live

**Epic:** E02-car-listings-with-verified-photos
**Blocked by:** E02-F02, E01-F04
**PRD coverage:** AC-14, AC-16, AC-17, AC-30, AC-31 (auto side)

## User story
As a shop owner, I want to submit my listing and have it go live automatically when all photos pass, so that buyers can see my car.

## Layers touched
DB: `submit_listing` RPC (completeness, 4–20 photos, cap, own-VIN duplicate, flags), `evaluate_listing`, live-VIN unique index · Service: listing.service.submit · Jobs: email templates listing_live/listing_rejected/listing_in_review · UI: Submit button, status banner with reasons on /sell/listings/[id], a public-visible check via GET /api/listings/:id

## Visible result (vertical slice test)
The owner submits a complete listing with 4 passing photos → status Checking → Live, and they get a 'Your car is live' email. A listing with a rejected photo becomes Rejected with the reason shown. The 11th active listing is refused with LISTING_LIMIT_REACHED.

## Rough issue list
1. submit_listing + evaluate_listing RPCs + listing.service.submit + route
2. Seller listing page with status banner/reasons + go-live emails + GET /api/listings/:id (owner/public views)

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
