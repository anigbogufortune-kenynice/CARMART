# E01-F02: Create and edit my shop + public shop page

**Epic:** E01-verified-seller-shops
**Blocked by:** E01-F01
**PRD coverage:** AC-04, AC-07, AC-09 (display), AC-10

## User story
As a user, I want to create my one shop and edit its details, so that I can start selling; and as a visitor, I want to see an approved shop's page.

## Layers touched
DB: `shops` table, RLS, AU postcode rules · Lib: `au-postcode.ts` · Service: shop.service · Routes: `POST /api/shops`, `GET/PATCH /api/shops/me` · UI: `/sell` onboarding checklist, `/sell/shop` form, `/shops/[slug]` public page (initials avatar, no image uploads)

## Visible result (vertical slice test)
A signed-in user creates 'Coastal Cars', edits it, and sees the checklist. `/shops/coastal-cars` returns 404 until approval (and is visible after an admin approves it in F04; before that, it's verified via a seeded approved shop).

## Rough issue list
1. shops migration + RLS + au-postcode validation
2. shop.service create/update/getMine/getPublicBySlug + API routes
3. /sell checklist + /sell/shop form + /shops/[slug] public page

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
