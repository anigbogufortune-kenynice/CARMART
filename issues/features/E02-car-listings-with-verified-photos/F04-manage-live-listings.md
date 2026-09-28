# E02-F04: Manage live listings

**Epic:** E02-car-listings-with-verified-photos
**Blocked by:** E02-F03
**PRD coverage:** AC-32 to AC-36

## User story
As a shop owner, I want to edit a live listing, add photos, mark it sold, and renew it when it expires, so that my listings stay accurate.

## Layers touched
DB: edit-rule enforcement (`update_listing_identity`), `mark_listing_sold`, `renew_listing`, `expire_listings`, `queue_expiry_reminders`, `unpublish_old_sold` pg_cron jobs · Service: listing.service (edit, markSold, renew) · Jobs: listing_expiring template, `/api/internal/unpublish-listing` · UI: edit form on live listings, Mark as sold, Renew, expiry date display

## Visible result (vertical slice test)
The owner changes the price on a live listing (it stays live); changes the VIN (back to Checking); adds a photo (hidden until it passes); marks it sold (SOLD banner). Running expire_listings() with a past expires_at makes it Expired, and Renew sends it back to Checking.

## Rough issue list
1. Live edit rules (minor vs identity) + photo add/delete-on-live rules
2. Mark sold + sold visibility window + unpublish-listing job
3. Expiry, reminders, renew + pg_cron schedules

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
