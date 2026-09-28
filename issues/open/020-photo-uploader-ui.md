# Issue 020: Photo uploader with live check status, HEIC conversion and reordering

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F02-photo-upload-and-verification
**Type:** AFK
**Status:** open
**Blocked by:** #016, #015
**Priority:** high
**Branch:** feature/020-photo-uploader-ui

## Goal
On the listing page the owner drags in photos, iPhone HEIC files are converted automatically, and each photo shows a live status chip (Checking → Passed / Rejected with reason / Under review).

## User Story
As a shop owner, I want to add photos easily and see immediately whether each is accepted, so that I can fix problems straight away.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Listing photos (POST images, complete, status, order, DELETE)
- docs/decisions.md: ADR-007
- docs/architecture.md: Data Flow (Photo upload)

### System specs
- docs/systems/image-verification.md: Photo states + seller-facing reasons

## Acceptance Criteria
- [ ] Drop or select multiple files; HEIC/HEIF are converted to JPEG in the browser (heic2any) before requesting an upload URL; other types show 'Only JPG, PNG, WebP or iPhone photos'
- [ ] Each file: request URL → PUT → complete; progress shown; a 429 UPLOAD_LIMIT shows 'Daily upload limit reached — try again tomorrow'
- [ ] The status list polls every 3 s while any photo is checking, and stops when none are
- [ ] Chips: Checking (grey), Passed (green), Rejected (red + reason), Under review (amber + reason)
- [ ] Drag to reorder → PUT /api/listings/:id/images/order; delete a photo with confirmation
- [ ] The counter shows 'N / 20 photos (min 4)'

## Files to Modify
- src/components/listing/PhotoUploader.tsx
- src/components/listing/PhotoStatusChip.tsx
- src/lib/heic-to-jpeg.ts
- src/app/api/listings/[id]/images/order/route.ts
- src/services/image-upload.service.ts: `reorderPhotos`
- src/app/sell/listings/[id]/page.tsx: embed the uploader

**Test files (in scope):**
- src/components/listing/PhotoUploader.test.tsx
- src/components/listing/PhotoStatusChip.test.tsx
- src/lib/heic-to-jpeg.test.ts
- tests/services/image-reorder.test.ts

## Out of Scope
- Submit button (021)
- Live-listing photo rules (023)

## Implementation Plan

Step 1: heic-to-jpeg
Test 1: heic-to-jpeg.test.ts (heic2any is a third-party lib → stubbed) → a File named 'IMG_1.HEIC' of type '' is converted and the returned File has type 'image/jpeg' and name 'IMG_1.jpg'; a 'photo.jpg' is returned unchanged
File:   src/lib/heic-to-jpeg.ts

Step 2: reorderPhotos + route
Test 2: tests/services/image-reorder.test.ts → `reorderPhotos(db, listingId, [c,a,b])` → positions c=0,a=1,b=2; a list missing an id → VALIDATION_ERROR
File:   image-upload.service.ts, order route

Step 3: PhotoStatusChip
Test 3: renders 'Rejected' with the text of status_reason; 'Under review' with the amber style; 'Passed' green
File:   PhotoStatusChip.tsx

Step 4: PhotoUploader flow + polling
Test 4: PhotoUploader.test.tsx (fetch mocked at the network boundary with MSW) → dropping 2 JPGs makes 2 POST, 2 PUT and 2 complete calls; the status poll starts, and after the mocked status turns passed/rejected, polling stops (no call after the next 3 s tick); a 429 shows the daily-limit message
File:   PhotoUploader.tsx

Step 5: Page embed
Test 5: /sell/listings/[id] renders the PhotoUploader below the form with the counter '0 / 20 photos (min 4)'
File:   src/app/sell/listings/[id]/page.tsx

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test && npm run test:integration -- image-reorder

### Manual verification
1. Open a draft, drop car-exterior.jpg, dog.jpg and borderline-ai.jpg from tests/fixtures/images
2. Within seconds: green Passed, red Rejected ('doesn't show a car'), amber Under review
3. Drag the passed photo to the second position and reload: the order is kept
4. On an iPhone (or with a .heic sample) upload a HEIC photo → it uploads as JPEG

## Git
- Branch: feature/020-photo-uploader-ui
- Commit: feat(photos): add photo uploader with live status, HEIC conversion and reordering closes #020
- PR title: 020 Photo uploader with live check status, HEIC conversion and reordering
