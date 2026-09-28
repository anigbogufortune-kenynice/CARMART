# Issue 017: Image decision table, fake providers and test fixtures

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F02-photo-upload-and-verification
**Type:** AFK
**Status:** open
**Blocked by:** #001
**Priority:** critical
**Branch:** feature/017-image-decision-table-and-fakes

## Goal
The rules that turn check results into passed/rejected/in_review exist as a pure, exhaustively tested function, with deterministic fake providers and fixture images for every branch.

## User Story
As the platform, I want image decisions to be predictable and fully tested, so that sellers are treated consistently.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/decisions.md: ADR-003, ADR-004, ADR-009
- docs/env.md: CAR_CHECK_PROVIDER / AI_CHECK_PROVIDER = fake

### System specs
- docs/systems/image-verification.md: Decision table D1–D10, Provider contracts, Fake providers, INV-I5, INV-I6

## Acceptance Criteria
- [ ] `decide(inputs, settings)` implements D1–D10 exactly: the worst outcome wins; reasons collected; the first rejected reason is the seller reason
- [ ] Band edges: ai 0.49 → pass, 0.50 → review, 0.89 → review, 0.90 → reject; car false @ 0.84 → review, @ 0.85 → reject; car true @ 0.79 → review, @ 0.80 → pass
- [ ] Fake providers return results from `tests/fixtures/images/manifest.json` keyed by the SHA-256 of the file bytes; an unknown image → pass in local mode, throws `UNKNOWN_FIXTURE` when `FAKE_PROVIDER_STRICT=1` (CI)
- [ ] `scripts/generate-fixtures.ts` deterministically creates the fixtures with sharp: car-exterior.jpg, car-interior.jpg, dog.jpg, ai-car.jpg, borderline-ai.jpg, screen-photo.jpg, vendor-error.jpg, tiny.jpg (640×480), with-gps.jpg (EXIF GPS), animated.webp, not-an-image.jpg (text bytes), and writes manifest.json

## Files to Modify
- src/server/jobs/image-verification/decide.ts
- src/server/jobs/image-verification/providers/types.ts
- src/server/jobs/image-verification/providers/fake.provider.ts
- scripts/generate-fixtures.ts
- tests/fixtures/images/manifest.json
- package.json: script `fixtures`

**Test files (in scope):**
- src/server/jobs/image-verification/decide.test.ts
- src/server/jobs/image-verification/providers/fake.provider.test.ts
- tests/fixtures/images/* (generated, committed)

## Out of Scope
- Real vendor calls (019)
- Image processing with sharp in the pipeline (018)

## Implementation Plan

Step 1: decide(): pass path + AI bands
Test 1: decide.test.ts → `decide({ car: { isCar: true, confidence: 0.97, isScreenOrPrint: false }, ai: { score: 0.49 } }, DEFAULTS)` → `{ outcome: 'passed', reasons: [] }`; score 0.50 → in_review; 0.89 → in_review; 0.90 → rejected with reason starting 'This photo appears to be AI-generated'
File:   decide.ts

Step 2: decide(): car rules + screen + pHash + validation + vendor failure
Test 2: car false 0.85 → rejected 'This photo doesn't show a car…'; false 0.84 → in_review; true 0.79 → in_review; `isScreenOrPrint: true` → in_review; `phashMatch: {…}` → in_review; `validationError: 'Photo is too small (minimum 800×600).'` → rejected with that reason; `vendorFailed: true` → in_review 'Automatic check unavailable, under manual review.'
File:   decide.ts

Step 3: Worst outcome wins
Test 3: ai 0.95 + car false 0.99 → rejected, and the reasons array has both, with the first rejected reason as sellerReason; ai 0.6 + car true 0.97 → in_review
File:   decide.ts

Step 4: Fixtures generator + manifest
Test 4: `npm run fixtures` creates 11 files; running it twice yields identical SHA-256 hashes (deterministic)
File:   scripts/generate-fixtures.ts, tests/fixtures/images/manifest.json, package.json

Step 5: Fake providers
Test 5: fake.provider.test.ts → the car check on dog.jpg → `{ ok: true, value: { isCar: false, confidence: 0.95 } }`; the AI check on ai-car.jpg → score 0.95; vendor-error.jpg → `{ ok: false, error: { code: 'VENDOR_ERROR' } }`; an unknown buffer with FAKE_PROVIDER_STRICT=1 → UNKNOWN_FIXTURE
File:   providers/types.ts, providers/fake.provider.ts

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/image-verification.md:**
- Decision table D1–D10, with every row and band edge tested (see Implementation Notes)
- INV-I5: a vendor error can never produce passed
- INV-I6: tests never call paid vendors

## How to Test

### Local stack + migrations
npm install

### Automated tests
npm run fixtures && npm run test -- image-verification (≈ 20 decide tests + fake provider tests)

### Manual verification
1. Open tests/fixtures/images/manifest.json: every fixture has an expected car and AI result
2. Change ai_reject_threshold in a decide test to 0.8: the 0.85 case flips to rejected (proves the thresholds come from settings)

## Git
- Branch: feature/017-image-decision-table-and-fakes
- Commit: feat(photos): add image decision table, fake providers and fixtures closes #017
- PR title: 017 Image decision table, fake providers and test fixtures
