# Issue 007: Create my shop (shops table, postcode rules, create form)

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F02-create-shop-and-public-page
**Type:** AFK
**Status:** open
**Blocked by:** #005
**Priority:** high
**Branch:** feature/007-create-shop

## Goal
A signed-in, verified user can create their one shop as a draft from /sell/shop.

## User Story
As a user, I want to create my shop, so that I can start selling cars.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: shops (columns, indexes, RLS)
- docs/api-contracts.md: POST /api/shops, Shop response shape, shared Zod building blocks
- docs/systems/shop-onboarding.md: Postcode ↔ state ranges, BR-S1 to BR-S3

### System specs
- docs/systems/shop-onboarding.md: `create_shop` transition, INV-S1, BR-S1, BR-S2, BR-S3

## Acceptance Criteria
- [ ] POST /api/shops creates a `draft` shop owned by the caller (201)
- [ ] A second shop for the same user → 409 SHOP_ALREADY_EXISTS; a duplicate slug → 409 SLUG_TAKEN
- [ ] Postcode 3000 with state NSW → 422 POSTCODE_STATE_MISMATCH; 2600 with ACT → accepted
- [ ] Anonymous users can't read draft shops; owners can read their own
- [ ] /sell/shop shows a create form with inline validation, and on success shows 'Shop created (draft)'

## Files to Modify
- supabase/migrations/20260928000700_shops.sql: shop_status + au_state enums, shops table, indexes, owns_shop(), RLS + column grants
- src/lib/au-postcode.ts: `isPostcodeInState(postcode, state)`
- src/types/domain.ts: AuStateSchema, PostcodeSchema, SlugSchema, ShopCreateSchema
- src/services/shop.service.ts: `createShop`, `getMyShop`
- src/app/api/shops/route.ts
- src/app/sell/shop/page.tsx

**Test files (in scope):**
- src/lib/au-postcode.test.ts
- tests/services/shop.service.test.ts
- tests/rls/shops.test.ts

## Out of Scope
- Editing a shop and the public page (issue 008)
- Submitting for approval (issue 010)

## Implementation Plan

Step 1: Postcode ↔ state
Test 1: au-postcode.test.ts → isPostcodeInState('2000','NSW') true; ('2600','ACT') true; ('2600','NSW') false; ('0800','NT') true; ('3000','NSW') false; ('7000','TAS') true; ('9999','QLD') true
File:   src/lib/au-postcode.ts

Step 2: shops migration + RLS
Test 2: tests/rls/shops.test.ts → owner inserts `{ owner_id: a.id, status: 'draft', … }` OK; inserting with `status: 'approved'` → RLS error; a second insert for the same owner → unique violation; `anonDb().from('shops').select('id')` returns 0 rows for a draft
File:   migration

Step 3: createShop service
Test 3: tests/services/shop.service.test.ts → `createShop(asUser(a), validInput)` → ok with status 'draft'; again → `{ ok: false, error: { code: 'SHOP_ALREADY_EXISTS' } }`; another user with the same slug → SLUG_TAKEN; postcode 3000 + NSW → POSTCODE_STATE_MISMATCH
File:   src/services/shop.service.ts, src/types/domain.ts

Step 4: POST /api/shops
Test 4: route test → unknown key `status` in the body → 422; valid → 201 `{ data: { slug: 'coastal-cars', status: 'draft' } }`
File:   src/app/api/shops/route.ts

Step 5: /sell/shop create form
Test 5: component test → typing slug 'Coastal Cars' shows 'Use lowercase letters, numbers and hyphens'; the submit posts to /api/shops and shows 'Shop created (draft)'
File:   src/app/sell/shop/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- Transition: — --create_shop--> draft; guard: caller verified and active; no existing shop; slug unique; postcode matches state
- Invariant INV-S1: one shop per profile (unique owner_id), with a test
- Edge case EC-S6: slug race → the unique index yields 409 SLUG_TAKEN, with a test

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test (au-postcode) && npm run test:integration -- shops (RLS + service)

### Manual verification
1. Signed in, open /sell/shop, create 'Coastal Cars' / coastal-cars / Parramatta / NSW / 2150 → 'Shop created (draft)'
2. Try again → 'You already have a shop'
3. Try postcode 3000 with NSW → the postcode error is shown

## Git
- Branch: feature/007-create-shop
- Commit: feat(shops): add shops table, postcode rules and create-shop flow closes #007
- PR title: 007 Create my shop (shops table, postcode rules, create form)
