# E05-F04: Suspensions, listing caps, settings and audit log

**Epic:** E05-trust-and-moderation
**Blocked by:** E05-F01, E05-F02
**PRD coverage:** AC-28, AC-49 to AC-52

## User story
As an admin, I want to suspend shops and users, raise listing caps, tune thresholds and see every admin action, so that I can run the marketplace safely.

## Layers touched
DB: suspend/unsuspend shop + user RPCs, listing-cap RPC · Services: moderation.service, settings.service (validated ranges) · Routes: admin suspend/unsuspend, listing-cap, settings GET/PATCH, audit-log · UI: `/admin/settings`, `/admin/audit-log`, suspend controls

## Visible result (vertical slice test)
The admin suspends a shop → its cars vanish from search; unsuspends → back. Changing ai_review_threshold to 0.6 affects the next photo checked. Every action appears in /admin/audit-log, which nobody can edit.

## Rough issue list
1. Suspend/unsuspend shops and users + listing cap
2. Settings service + page (validated thresholds)
3. Audit log page + append-only enforcement tests

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
