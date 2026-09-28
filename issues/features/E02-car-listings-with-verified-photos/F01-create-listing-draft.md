# E02-F01: Create a car listing draft

**Epic:** E02-car-listings-with-verified-photos
**Blocked by:** E01-F02
**PRD coverage:** AC-11, AC-12, AC-13, AC-15

## User story
As a shop owner, I want to fill in a structured car listing (make/model from a list, VIN, price, km…), so that buyers get accurate details.

## Layers touched
DB: `vehicle_makes`/`vehicle_models` + seed (AU car makes/models, no trucks or motorbikes), `listings` table + enums + indexes + RLS · Lib: `vin.ts` · Service: listing.service (create/update draft/delete draft/listMine) · Routes: `GET /api/vehicle-makes`, `/models`, `POST/PATCH/DELETE /api/listings`, `GET /api/shops/me/listings` · UI: `/sell/listings`, `/sell/listings/new` form with dependent make→model selects and an 'Other' option

## Visible result (vertical slice test)
The owner creates a draft '2019 Toyota HiLux', sees validation errors for a bad VIN or a postcode/state mismatch, saves it, and sees it in their listings table as Draft.

## Rough issue list
1. Vehicle reference tables + seed + read API
2. listings migration + RLS + VIN/postcode validation + listing.service draft CRUD
3. Listing draft routes + /sell/listings list + /sell/listings/new form

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
