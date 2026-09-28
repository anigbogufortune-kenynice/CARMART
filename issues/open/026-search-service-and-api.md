# Issue 026: Search service and public search API

**Epic:** E03-car-search-and-discovery
**Feature:** E03-car-search-and-discovery/F01-search-and-filter
**Type:** AFK
**Status:** open
**Blocked by:** #022
**Priority:** high
**Branch:** feature/026-search-service-and-api

## Goal
GET /api/listings returns live cars from approved shops with every filter, sort and pagination option, fast and correct.

## User Story
As a visitor, I want to filter cars by what matters to me, so that I only see relevant cars.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET /api/listings (search), query schema, response
- docs/schema.md: listings indexes (search, filters, GIN search_vector)

### System specs
- docs/systems/listing-lifecycle.md: INV-L3 (approved shops only), sold leaves search immediately

## Acceptance Criteria
- [ ] Only live listings of approved shops; filters make_id, model_id, price_min/max (cents), year_min/max, km_max, body_type, transmission, fuel, state, suburb (case-insensitive), postcode combine with AND
- [ ] `q` uses full-text search (search_vector, `websearch_to_tsquery('english', q)`)
- [ ] Sorts: newest (live_at desc, default), price_asc, price_desc, km_asc, year_desc; ties broken by id
- [ ] 24 per page with an accurate total; page beyond the end → empty data with the correct total
- [ ] Unknown query keys or bad values → 422; one query for the results + thumbnails (no N+1)
- [ ] The dev seed adds 30 live sample listings across 3 approved shops (with fixture photos marked passed) for local demos

## Files to Modify
- supabase/migrations/20260928002600_search.sql: filter/sort indexes + `search_listings(...)` SQL function
- src/services/search.service.ts: `searchListings`
- src/app/api/listings/route.ts: add GET
- src/types/domain.ts: SearchQuerySchema
- supabase/seed.sql: sample shops + live listings

**Test files (in scope):**
- tests/services/search.test.ts

## Out of Scope
- The /cars UI (027)
- Radius search (out of scope v1)

## Implementation Plan

Step 1: SearchQuerySchema
Test 1: parsing `{ price_min: '1000000', sort: 'price_asc', page: '2' }` → numbers; `{ sort: 'cheapest' }` → error; `{ foo: 1 }` → error (strict)
File:   src/types/domain.ts

Step 2: Visibility
Test 2: tests/services/search.test.ts → with 3 live (approved shop), 1 live (suspended shop), 1 checking, 1 sold → `searchListings(anon, {})` returns exactly the 3
File:   search.service.ts, migration

Step 3: Filters
Test 3: make Toyota → only Toyota; price_max 3000000 → all ≤ $30k; year_min 2018 & km_max 100000 → both hold; state QLD + body_type ute → only QLD utes; q 'turbo diesel' matches a description containing 'turbo diesel'
File:   migration, search.service.ts

Step 4: Sort + paging
Test 4: price_asc → non-decreasing prices; 30 results → page 2 has 6 items and total 30; page 5 → [] with total 30
File:   search.service.ts

Step 5: Route
Test 5: GET /api/listings?body_type=truck → 422; GET /api/listings → 200 `{ data: [...], page: { number: 1, size: 24, total } }`, and each item has thumbnail_url and shop.verified
File:   src/app/api/listings/route.ts

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- search

### Manual verification
1. curl 'localhost:3000/api/listings?make_id=<toyota>&state=QLD&sort=price_asc' → only QLD Toyotas, cheapest first
2. curl '…?page=99' → empty data, same total

## Git
- Branch: feature/026-search-service-and-api
- Commit: feat(search): add listing search service and public search API closes #026
- PR title: 026 Search service and public search API
