# E05-F03: Reports and auto-hide

**Epic:** E05-trust-and-moderation
**Blocked by:** E05-F02, E04-F01
**PRD coverage:** AC-38, Story 9, AC-43 (admin part)

## User story
As a user, I want to report a suspicious listing, shop or conversation; as an admin, I want a reports queue; and listings with 3 reports should hide automatically.

## Layers touched
DB: `reports` + RLS, `create_report` RPC (limits, one open per target, auto-hide at 3) · Services: moderation.service (create + queue + dismiss/action) · Routes: `POST /api/reports`, `GET /api/admin/queues/reports`, `POST /api/admin/reports/:id/dismiss|action` · UI: Report dialog on listing, shop and conversation; `/admin/reports`

## Visible result (vertical slice test)
Three different users report a listing → it disappears from search and shows in /admin/reports; the admin dismisses the reports and clears the flag → it is live again.

## Rough issue list
1. reports migration + create_report RPC + auto-hide + Report dialog
2. Reports queue + dismiss/action + admin read access to reported conversations

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
