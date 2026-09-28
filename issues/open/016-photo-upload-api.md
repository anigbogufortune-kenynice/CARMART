# Issue 016: Photo tables, private quarantine storage and the upload API

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F02-photo-upload-and-verification
**Type:** AFK
**Status:** open
**Blocked by:** #014
**Priority:** critical
**Branch:** feature/016-photo-upload-api

## Goal
An owner can upload a photo to private quarantine storage through a signed URL, confirm it, and see its status 'checking', with limits enforced.

## User Story
As a shop owner, I want to upload photos of my car, so that they can be checked and shown to buyers.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: listing_images, image_checks, upload_events, Storage buckets
- docs/api-contracts.md: Listing photos (POST images, complete, status, DELETE)
- docs/decisions.md: ADR-007

### System specs
- docs/systems/image-verification.md: transitions request_upload, complete, owner_delete; INV-I1, INV-I4, INV-I7; EC-I1, EC-I2, EC-I10

## Acceptance Criteria
- [ ] Buckets: `listing-quarantine` private, `listing-public` public; owners can upload only to `{shop_id}/{listing_id}/{image_id}` in quarantine via a signed URL (2 min, no overwrite)
- [ ] POST /api/listings/:id/images `{ mime_type, bytes }` → 201 with image_id + upload_url; mime must be jpeg/png/webp; > 10 MB → 422; the 21st non-deleted photo → 422 PHOTO_COUNT; the 61st upload in 24 h for the shop → 429 UPLOAD_LIMIT
- [ ] POST …/complete → 202 status 'checking' and one queued image_checks row (idempotent: a second call returns the same job, still one row); a missing object → 409 UPLOAD_MISSING
- [ ] GET …/images/status returns each photo's status/reason (with signed thumbnails for the owner)
- [ ] DELETE soft-deletes a photo; anon can't read quarantine objects

## Files to Modify
- supabase/migrations/20260928001600_listing_images.sql: tables, image_status + check_job_state enums, buckets + storage policies, `request_image_upload` + `enqueue_image_check` RPCs, `image_check_status` view, RLS
- src/services/image-upload.service.ts: `requestUpload`, `completeUpload`, `getPhotoStatus`, `deletePhoto`
- src/app/api/listings/[id]/images/route.ts
- src/app/api/listings/[id]/images/[imageId]/complete/route.ts
- src/app/api/listings/[id]/images/[imageId]/route.ts: DELETE
- src/app/api/listings/[id]/images/status/route.ts
- supabase/migrations: also `delete_listing_image` RPC (owner soft delete with the live-listing guard; no client grant on deleted_at)
- src/lib/uuid.ts: `isUuid` for route params
- src/types/domain.ts: UploadRequestSchema, ImageStatus
- docs/api-contracts.md, docs/schema.md: signed-URL lifetime, quarantine_path format, owner grants

**Test files (in scope):**
- tests/services/image-upload.test.ts
- tests/rls/listing-images.test.ts
- src/lib/uuid.test.ts
- e2e/photo-upload.spec.ts (Step 5 routes)

## Out of Scope
- Running the checks (017–019)
- Uploader UI (020)
- Reordering (020)

## Implementation Plan

Step 1: Tables, buckets, storage policies
Test 1: tests/rls/listing-images.test.ts → `anonDb().storage.from('listing-quarantine').download(path)` → error; the owner can upload through the signed URL; another user's signed-URL request for the listing → FORBIDDEN
File:   migration

Step 2: requestUpload limits
Test 2: tests/services/image-upload.test.ts → `requestUpload(db, listingId, { mime_type: 'image/gif', bytes: 10 })` → VALIDATION_ERROR; with 20 non-deleted photos → PHOTO_COUNT; after inserting 60 upload_events for the shop in the last 24 h → UPLOAD_LIMIT
File:   src/services/image-upload.service.ts

Step 3: completeUpload + idempotency
Test 3: without uploading the file → UPLOAD_MISSING; after upload → `{ status: 'checking' }`; calling it twice → still 1 image_checks row in state 'queued'
File:   src/services/image-upload.service.ts, migration

Step 4: Status + delete
Test 4: getPhotoStatus returns `[{ image_id, position: 0, status: 'checking', status_reason: null, thumbnail_url: <signed> }]`; deletePhoto sets deleted_at and the photo disappears from status
File:   src/services/image-upload.service.ts

Step 5: Routes
Test 5: POST images for someone else's listing → 404; complete → 202; DELETE → 204
File:   4 route files

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/image-verification.md:**
- request_upload guards: owner; listing ∈ {draft, rejected, expired, live}; < 20 photos; < daily_upload_limit uploads per shop per 24 h; mime jpeg/png/webp; ≤ 10 MB
- INV-I1: quarantine is private; only the job runner writes listing-public
- INV-I4: at most one open job per image (partial unique index), with a test
- EC-I1: complete before the upload → 409 UPLOAD_MISSING; EC-I2: size mismatch → object deleted, image rejected
- EC-I10: the upload limit returns 429 UPLOAD_LIMIT

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- image-upload listing-images

### Manual verification
1. Request an upload URL for a draft (curl), PUT a JPEG to it, call complete → 202 checking
2. Try to open the quarantine object URL without auth → 400/404

## Git
- Branch: feature/016-photo-upload-api
- Commit: feat(photos): add photo tables, quarantine storage and upload API closes #016
- PR title: 016 Photo tables, private quarantine storage and the upload API
