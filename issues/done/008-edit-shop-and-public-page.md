# Issue 008: Edit my shop, the seller checklist and the public shop page

**Epic:** E01-verified-seller-shops
**Feature:** E01-verified-seller-shops/F02-create-shop-and-public-page
**Type:** AFK
**Status:** open
**Blocked by:** #007
**Priority:** high
**Branch:** feature/008-edit-shop-and-public-page

## Goal
Owners can edit their shop and see an onboarding checklist, and approved shops have a public page at /shops/[slug].

## User Story
As a shop owner, I want to edit my shop and see what's left to do; as a visitor, I want to view an approved shop.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: GET/PATCH /api/shops/me, Shop response shape
- docs/schema.md: shops RLS (public reads approved)
- docs/architecture.md: Page map (/sell, /shops/[slug])

### System specs
- docs/systems/shop-onboarding.md: BR-S5 (slug lock), INV-S2, Computed values (verified)

## Acceptance Criteria
- [ ] GET /api/shops/me returns the owner's shop (404 if none); PATCH updates name/description/suburb/state/postcode/slug
- [ ] Changing the slug when status isn't draft/rejected, or after first approval → 409 SLUG_LOCKED
- [ ] /sell shows the checklist: 1 Create shop ✓/✗, 2 Verify phone, 3 Submit for approval, 4 Approved
- [ ] /shops/[slug] renders name, suburb/state, description, 'Member since', an initials avatar and the 'Verified shop' badge for approved + phone-verified shops; a non-approved slug → 404
- [ ] No image upload control exists on any shop page

## Files to Modify
- src/services/shop.service.ts: `updateMyShop`, `getPublicShopBySlug`
- src/app/api/shops/me/route.ts
- src/components/shop/ShopForm.tsx: shared create/edit form
- src/app/sell/shop/page.tsx: use ShopForm (create or edit)
- src/app/sell/page.tsx
- src/app/shops/[slug]/page.tsx
- supabase/migrations/20260928000800_shop_edit_and_public_view.sql: slug-lock trigger (INV-S5) + `public_shops` view (approved shops + computed `verified`, no owner-only fields)
- src/components/shop/SellChecklist.tsx: checklist (page files can't export testable helpers)

**Test files (in scope):**
- tests/services/shop.service.test.ts
- src/components/shop/ShopForm.test.tsx
- src/components/shop/SellChecklist.test.tsx

## Out of Scope
- Phone verification (009)
- Submit (010)
- Active listings on the shop page (added in 027)

## Implementation Plan

Step 1: updateMyShop + slug lock
Test 1: `updateMyShop(db, { name: 'Coastal Cars NSW' })` ok; with status set to pending_approval via adminDb, `updateMyShop(db, { slug: 'new' })` → SLUG_LOCKED; with `approved_at` set and status rejected → SLUG_LOCKED
File:   src/services/shop.service.ts

Step 2: getPublicShopBySlug
Test 2: draft shop → `{ ok: false, error: { code: 'NOT_FOUND' } }`; after adminDb sets status approved and the owner's phone_verified_at → `{ ok: true, value: { verified: true, … } }` (no status_reason or listing_cap fields)
File:   src/services/shop.service.ts

Step 3: GET/PATCH /api/shops/me
Test 3: GET without a shop → 404 NOT_FOUND; PATCH `{ listing_cap: 50 }` → 422 (strict body)
File:   src/app/api/shops/me/route.ts

Step 4: ShopForm (create + edit) and /sell checklist
Test 4: ShopForm.test.tsx → edit mode pre-fills values and PATCHes only changed fields; the checklist component shows 'Create shop' done when the shop exists
File:   src/components/shop/ShopForm.tsx, src/app/sell/shop/page.tsx, src/app/sell/page.tsx

Step 5: Public shop page
Test 5: page render test with an approved shop → heading 'Coastal Cars', text 'Verified shop', no `input[type=file]`; a draft slug → notFound() called
File:   src/app/shops/[slug]/page.tsx

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/shop-onboarding.md:**
- BR-S5 / INV-S5: slug editable only in draft/rejected and never after first approval
- INV-S2: non-approved shops aren't publicly visible
- Computed `verified` = approved AND owner phone verified

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- shop

### Manual verification
1. Open /sell → the checklist shows step 1 done
2. Edit the shop description in /sell/shop → saved
3. Open /shops/coastal-cars → 404 (draft)
4. In Studio set status='approved' → reload shows the page (badge appears only once the phone is verified)

## Git
- Branch: feature/008-edit-shop-and-public-page
- Commit: feat(shops): add shop editing, seller checklist and public shop page closes #008
- PR title: 008 Edit my shop, the seller checklist and the public shop page
