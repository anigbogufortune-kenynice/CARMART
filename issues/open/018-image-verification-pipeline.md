# Issue 018: Image verification job: validate, fingerprint, check, decide, clean and publish

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F02-photo-upload-and-verification
**Type:** AFK
**Status:** open
**Blocked by:** #016, #017, #006
**Priority:** critical
**Branch:** feature/018-image-verification-pipeline

## Goal
Queued photos are processed end to end: invalid files are rejected, reused photos flagged, checks run (fake providers), and passed photos are stripped of metadata and published as 3 WebP sizes.

## User Story
As a seller, I want my photos checked automatically within seconds; as a buyer, I want only checked, privacy-safe photos shown.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/api-contracts.md: Internal: POST /api/internal/process-image-checks, /unpublish-image
- docs/schema.md: image_checks, listing_images, Scheduled jobs
- docs/decisions.md: ADR-006, ADR-009

### System specs
- docs/systems/image-verification.md: Pipeline steps 1–10, INV-I1 to INV-I4, EC-I3 to EC-I9, EC-I11

## Acceptance Criteria
- [ ] An AFTER INSERT trigger on image_checks + a pg_cron minute job call the internal route via pg_net; `requeue_stale_checks()` runs every 5 min
- [ ] Claiming uses FOR UPDATE SKIP LOCKED and increments attempts; a done job is never reprocessed
- [ ] with-gps.jpg → passed, and all 3 public WebP files have no EXIF/XMP/IPTC (verified with sharp metadata); dimensions: long edge 400/1024/1600 (or original if smaller)
- [ ] tiny.jpg, animated.webp and not-an-image.jpg → rejected with the D1 reasons; dog.jpg → rejected; borderline-ai.jpg → in_review; vendor-error.jpg → requeued, then in_review after 3 attempts
- [ ] The same photo uploaded by a different shop → in_review with a phash_match recorded; by the same shop → no flag
- [ ] `record_image_decision` writes results, updates the image and calls `evaluate_listing(listing_id)` (created here as a no-op placeholder; implemented in 021)

## Files to Modify
- supabase/migrations/20260928001800_image_pipeline.sql: `claim_image_check`, `record_image_decision`, placeholder `evaluate_listing`, `requeue_stale_checks`, pg_net trigger + pg_cron jobs
- src/server/jobs/image-verification/process-image.ts: validate, normalise, pHash, stripAndEncode
- src/server/jobs/image-verification/pipeline.ts: `processNextJobs(limit)`
- src/server/jobs/image-verification/publish.ts: upload/delete public variants
- src/app/api/internal/process-image-checks/route.ts
- src/app/api/internal/unpublish-image/route.ts
- scripts/generate-fixtures.ts + tests/fixtures/images/*: seed-driven shapes so distinct fixtures have distinct pHashes (they collided at distance 6)
- package.json: exifr (camera metadata signals and the INV-I2 test)
- supabase migration also: `image_checks.thresholds` (INV-I3), `invoke_internal_job(path, body)`, `find_phash_match`, `requeue_image_check`, and `delete_listing_image` now unpublishes passed photos
- issues/open/020-photo-uploader-ui.md: notes from 016

**Test files (in scope):**
- src/server/jobs/image-verification/process-image.test.ts
- tests/jobs/image-pipeline.test.ts

## Out of Scope
- Real providers (019)
- The listing going live (021)
- Admin forced decisions (040)

## Implementation Plan

Step 1: process-image: validate
Test 1: process-image.test.ts (real sharp, real fixtures) → `validate(tinyJpg, 'image/jpeg')` → `{ ok: false, reason: 'Photo is too small (minimum 800×600).' }`; animated.webp → 'Animated images aren't allowed.'; not-an-image.jpg → 'We couldn't read this file as a photo.'; car-exterior.jpg → ok with width/height
File:   process-image.ts

Step 2: process-image: pHash + strip/encode
Test 2: `phash(carExterior)` returns a 64-char bit string, stable across runs; `hamming(phash(a), phash(a re-encoded at q60)) ≤ 6`; `stripAndEncode(withGps)` returns 3 buffers whose `sharp(buf).metadata()` has no `exif`, `xmp` or `iptc`, and widths 400/1024/1600 for a 3000 px source
File:   process-image.ts

Step 3: Claim + record RPCs
Test 3: tests/jobs/image-pipeline.test.ts → two concurrent `claim_image_check` calls on 1 queued job → one gets it, the other gets none; `record_image_decision` on an image with deleted_at set → returns 'SKIPPED' and changes nothing
File:   migration

Step 4: processNextJobs end to end (fake providers)
Test 4: upload car-exterior + dog + borderline-ai via the upload service, then `processNextJobs(5)` → statuses passed/rejected/in_review with the D-table reasons; the passed image has public_paths {sm,md,lg} and the files exist in listing-public; the others have no public files
File:   pipeline.ts, publish.ts

Step 5: Retries + reuse + routes
Test 5: vendor-error.jpg: run processNextJobs 3× (with requeue) → attempts 3, image in_review; the same bytes uploaded by a second shop → in_review with phash_match.matched_shop_id = first shop; POST /api/internal/process-image-checks without the secret → 401
File:   pipeline.ts, both internal routes, migration

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/image-verification.md:**
- Pipeline steps 1–10 in order; upload variants BEFORE updating the DB
- INV-I2: no public file contains metadata (tested on with-gps.jpg)
- INV-I4: idempotent claims (SKIP LOCKED + done check)
- EC-I4/EC-I5: deleted image or removed listing → discard results and delete fresh variants
- EC-I6: stale running jobs are requeued after 5 min
- EC-I7: same-shop reuse isn't flagged; EC-I9: duplicate pg_net calls are no-ops

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev (CAR_CHECK_PROVIDER=fake, AI_CHECK_PROVIDER=fake; Vault secrets from issue 012)

### Automated tests
npm run test -- process-image && npm run test:integration -- image-pipeline

### Manual verification
1. Upload tests/fixtures/images/car-exterior.jpg to a draft via the API and call complete
2. Within a few seconds GET …/images/status shows passed; open the md.webp public URL → the image shows
3. Run `npx exiftool <downloaded md.webp>` (or sharp metadata) → no GPS or EXIF
4. Upload dog.jpg → status rejected: 'This photo doesn't show a car…'

## Git
- Branch: feature/018-image-verification-pipeline
- Commit: feat(photos): add image verification pipeline with metadata stripping and publishing closes #018
- PR title: 018 Image verification job: validate, fingerprint, check, decide, clean and publish
