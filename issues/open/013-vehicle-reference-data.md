# Issue 013: Car-only make and model reference data

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F01-create-listing-draft
**Type:** AFK
**Status:** open
**Blocked by:** #005
**Priority:** high
**Branch:** feature/013-vehicle-reference-data

## Goal
The app has an Australian car-only list of makes and models, readable by anyone through the API.

## User Story
As a seller, I want to pick my car's make and model from a list, so that my listing is accurate and searchable.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: vehicle_makes, vehicle_models
- docs/api-contracts.md: Reference data
- docs/decisions.md: ADR-005

## Acceptance Criteria
- [ ] `vehicle_makes`/`vehicle_models` exist with RLS (read: everyone; write: admin only)
- [ ] The seed contains ≥ 40 makes sold in Australia and ≥ 400 models (passenger cars, SUVs, utes, people movers). It contains no truck, bus, motorbike, caravan or boat makes (e.g. no Kenworth, Harley-Davidson, Jayco)
- [ ] GET /api/vehicle-makes returns active makes alphabetically; GET /api/vehicle-makes/:id/models returns active models alphabetically; an unknown make → 404

## Files to Modify
- supabase/migrations/20260928001300_vehicle_reference.sql
- supabase/seed.sql: append makes/models (idempotent `on conflict do nothing`)
- src/services/listing.service.ts: `listMakes`, `listModels` (file created here)
- src/app/api/vehicle-makes/route.ts
- src/app/api/vehicle-makes/[makeId]/models/route.ts

**Test files (in scope):**
- tests/services/vehicle-reference.test.ts
- tests/seed/vehicle-seed.test.ts

## Out of Scope
- Admin editing of makes/models (the 'Other' review covers new makes in v1)

## Implementation Plan

Step 1: Tables + RLS
Test 1: tests/services/vehicle-reference.test.ts → `anonDb().from('vehicle_makes').select('name')` returns rows; `asUser(u).from('vehicle_makes').insert({ name: 'X' })` → RLS error; admin insert OK
File:   migration

Step 2: Seed coverage
Test 2: tests/seed/vehicle-seed.test.ts → count(makes) ≥ 40, count(models) ≥ 400; 'Toyota' has models 'HiLux', 'LandCruiser', 'Corolla', 'RAV4'; 'Ford' has 'Ranger'; no make in ['Kenworth','Mack','Harley-Davidson','Jayco','Yamaha'] exists
File:   supabase/seed.sql

Step 3: listMakes/listModels
Test 3: `listMakes(anon)` → ok, first item alphabetically ('Abarth' or 'Alfa Romeo'); `listModels(anon, randomUuid)` → `{ ok: false, error: { code: 'NOT_FOUND' } }`
File:   src/services/listing.service.ts

Step 4: Routes
Test 4: GET /api/vehicle-makes → 200 `{ data: [{ id, name }] }`; GET /api/vehicle-makes/<bad uuid>/models → 422
File:   routes

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- vehicle

### Manual verification
1. curl localhost:3000/api/vehicle-makes | head → alphabetical makes
2. curl the Toyota models endpoint → includes HiLux

## Git
- Branch: feature/013-vehicle-reference-data
- Commit: feat(listings): add car-only make and model reference data closes #013
- PR title: 013 Car-only make and model reference data
