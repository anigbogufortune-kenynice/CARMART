# E01-F03: Phone verification and submitting a shop for approval

**Epic:** E01-verified-seller-shops
**Blocked by:** E01-F02
**PRD coverage:** AC-06

## User story
As a shop owner, I want to verify my Australian mobile and submit my shop, so that an admin can approve it.

## Layers touched
DB: phone_verified_at sync trigger, `submit_shop` RPC · Service: profile.service (send/verify code), shop.service (submit) · Routes: `POST /api/profile/phone/send-code`, `/verify`, `POST /api/shops/me/submit` · UI: `/sell/phone` OTP form, submit button + 'pending approval' state on `/sell`

## Visible result (vertical slice test)
The owner enters +61400000000, types the local test OTP, sees 'Phone verified', submits, and the checklist shows 'Waiting for approval'. Submitting without a phone shows the PHONE_NOT_VERIFIED message.

## Rough issue list
1. Phone OTP send/verify (profile.service + routes + trigger) + /sell/phone page
2. submit_shop RPC + shop.service.submit + route + pending state in /sell

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
