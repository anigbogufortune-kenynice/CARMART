# E05-F02: Listing review: duplicate VINs, 'Other' make/model, reject and remove

**Epic:** E05-trust-and-moderation
**Blocked by:** E02-F03, E01-F04
**PRD coverage:** AC-14 (admin), AC-31 (admin), AC-37

## User story
As an admin, I want to resolve duplicate VINs and 'Other' makes, and reject or remove bad listings, so that every live listing is legitimate.

## Layers touched
DB: `admin_clear_listing_flag`, `admin_reject_listing`, `admin_remove_listing` RPCs · Service: moderation.service listing queues · Routes: `GET /api/admin/queues/duplicate-vins|other-make-model`, `POST /api/admin/listings/:id/clear-flag|reject|remove` · Jobs: listing_removed template + unpublish · UI: `/admin/duplicate-vins` side-by-side, `/admin/other-make-model`, remove dialog on the listing

## Visible result (vertical slice test)
Two shops list the same VIN: the second waits in /admin/duplicate-vins beside the first; removing the first then clearing the flag lets the second go live. Removing any listing hides it and emails the seller with the reason.

## Rough issue list
1. Duplicate-VIN + Other make/model queues with side-by-side view
2. Clear-flag / reject / remove RPCs + routes + removal email + unpublish

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
