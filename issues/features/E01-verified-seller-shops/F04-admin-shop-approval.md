# E01-F04: Admin shop approval queue with audit log and emails

**Epic:** E01-verified-seller-shops
**Blocked by:** E01-F03
**PRD coverage:** AC-08, AC-09, AC-49, AC-50 (shops), AC-51

## User story
As an admin, I want to approve or reject pending shops with a reason, so that only real sellers go public.

## Layers touched
DB: `admin_approve_shop` / `admin_reject_shop` RPCs writing admin_actions + notifications · Service: moderation.service (shop queue + decisions) · Routes: `GET /api/admin/queues/shops`, `POST /api/admin/shops/:id/approve|reject` · Jobs: email templates shop_approved/shop_rejected · UI: `/admin` layout (404 for non-admins), `/admin/shops` queue

## Visible result (vertical slice test)
An admin opens /admin/shops, approves 'Coastal Cars' → the public page goes live with a Verified badge, and the owner gets an email (in the log provider). A rejection shows its reason on /sell. Non-admins get a 404 on /admin.

## Rough issue list
1. Admin area shell + role guard + moderation.service shop queue
2. Approve/reject RPCs + routes + audit rows + email templates, and the queue UI actions

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
