# E05-F01: Image review queue

**Epic:** E05-trust-and-moderation
**Blocked by:** E02-F03, E01-F04
**PRD coverage:** AC-23/24 (review side), AC-50 (images)

## User story
As an admin, I want to review uncertain photos with the evidence and approve or reject them, so that genuine sellers aren't blocked and fakes don't get through.

## Layers touched
DB: admin approve/reject image RPCs (forced_decision job, unpublish) · Service: moderation.service image queue · Routes: `GET /api/admin/queues/images`, `POST /api/admin/images/:id/approve|reject` · UI: `/admin/images` with signed preview, car-check + AI score, metadata signals, pHash match side-by-side

## Visible result (vertical slice test)
The borderline fixture from E02-F02 appears in /admin/images with its AI score of 0.70; approving it publishes it and the listing goes live; rejecting shows the reason to the seller.

## Rough issue list
1. Image queue service + route + admin page with evidence
2. Approve/reject image RPCs + forced-decision job path + listing re-evaluation

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
