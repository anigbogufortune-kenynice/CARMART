# E03-F01: Search and filter live cars

**Epic:** E03-car-search-and-discovery
**Blocked by:** E02-F03
**PRD coverage:** AC-39, AC-40, AC-41

## User story
As a visitor, I want to search and filter cars by make, price, year, km, body type and location, so that I find cars that suit me.

## Layers touched
DB: search indexes + search_vector · Service: search.service · Routes: `GET /api/listings` · UI: home page (search bar + latest 12), `/cars` with a filter panel (URL-driven), result cards, sorting, pagination, empty state

## Visible result (vertical slice test)
With seeded live listings, a visitor filters 'Toyota, under $50k, QLD, ute', sorts by price, pages through the results, and shares the URL, which reproduces the same results. Drafts and unapproved shops never appear.

## Rough issue list
1. search.service + GET /api/listings with every filter/sort + pagination
2. /cars page with filter panel, cards and pagination + home page latest cars

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
