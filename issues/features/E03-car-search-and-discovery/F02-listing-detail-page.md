# E03-F02: Listing detail page

**Epic:** E03-car-search-and-discovery
**Blocked by:** E03-F01
**PRD coverage:** AC-01, AC-35 (display), AC-54 (partial)

## User story
As a visitor, I want to see a car's photos, specs, VIN (with a PPSR link), location and shop, so that I can judge it.

## Layers touched
Service: search.service.getPublicListing · UI: `/cars/[id]` gallery (responsive WebP sizes), spec table, VIN + PPSR link, shop card with Verified badge, SOLD banner, 404 handling

## Visible result (vertical slice test)
Opening a live listing shows the gallery and specs; a sold listing shows SOLD for 7 days then 404s; a draft is 404 to the public but visible to its owner.

## Rough issue list
1. Public listing detail service + /cars/[id] page (gallery, specs, PPSR, shop card, SOLD)

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
