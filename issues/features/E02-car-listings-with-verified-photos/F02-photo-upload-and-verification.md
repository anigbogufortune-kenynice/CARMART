# E02-F02: Photo upload with live verification status

**Epic:** E02-car-listings-with-verified-photos
**Blocked by:** E02-F01
**PRD coverage:** AC-18 to AC-27, AC-29, AC-10

## User story
As a shop owner, I want to upload photos and see each one checked (car? AI?), so that I know right away if a photo will be accepted.

## Layers touched
DB: `listing_images`, `image_checks`, `upload_events`, storage buckets + policies, `enqueue_image_check`, `record_image_decision`, pg_net trigger · Service: image-upload.service · Jobs: image-verification (process-image with sharp, pHash, decide.ts, fake providers, Claude + Sightengine providers, publish variants), `/api/internal/process-image-checks`, `/unpublish-image` · UI: photo uploader (HEIC→JPEG, drag-reorder, per-photo status chips with reasons, polling)

## Visible result (vertical slice test)
On a draft, the owner drops 6 fixture photos: 4 turn green (Passed), a dog photo turns red ('doesn't show a car'), an AI fixture turns red ('appears AI-generated'), and a borderline one turns amber (Under review). The public bucket contains only metadata-free WebP files for the passed ones.

## Rough issue list
1. Photo tables, buckets, upload-URL + complete + status routes (image-upload.service) — photos show as 'checking'
2. Pure decision table decide.ts + fake providers + fixtures manifest
3. Job runner pipeline: validate/normalise/pHash/strip/WebP with sharp + record_image_decision + internal route + pg_net trigger
4. Real providers: Claude car check + Sightengine AI check (fake-tested contract, smoke script) + uploader UI with HEIC conversion, reorder, delete and status polling

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
