# E03-F03: Saved cars (watchlist)

**Epic:** E03-car-search-and-discovery
**Blocked by:** E03-F02
**PRD coverage:** Story 8

## User story
As a signed-in buyer, I want to save cars and see them later, so that I can compare options.

## Layers touched
DB: `saved_listings` + RLS · Routes: `GET/POST/DELETE /api/saved-listings` · UI: heart button on cards/detail (sign-in prompt for visitors), `/account/saved` with 'no longer available' state

## Visible result (vertical slice test)
A buyer saves 3 cars, sees them on /account/saved, unsaves one; when a saved car sells it shows 'No longer available'.

## Rough issue list
1. saved_listings migration + routes + heart button + /account/saved

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
