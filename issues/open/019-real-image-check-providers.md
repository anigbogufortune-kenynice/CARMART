# Issue 019: Claude car-check and Sightengine AI-check providers

**Epic:** E02-car-listings-with-verified-photos
**Feature:** E02-car-listings-with-verified-photos/F02-photo-upload-and-verification
**Type:** AFK
**Status:** open
**Blocked by:** #017
**Priority:** high
**Branch:** feature/019-real-image-check-providers

## Goal
Production can switch from the fake providers to real ones: Claude vision for 'is it a car' and Sightengine for 'is it AI', both returning the shared result types.

## User Story
As the platform, I want real detection vendors behind the same interface, so that production decisions are meaningful.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/architecture.md: External Integrations (Anthropic, Sightengine)
- docs/env.md: Job runner variables, src/server/jobs/env.ts
- docs/decisions.md: ADR-004, ADR-013

### System specs
- docs/systems/image-verification.md: Provider contracts, Claude car check, Sightengine AI check, EC-I11

## Acceptance Criteria
- [ ] `getProviders(jobsEnv)` returns the fake or real providers per env; `claude` without ANTHROPIC_API_KEY fails at env parse
- [ ] The Claude provider sends the JPEG as base64 with the fixed system prompt from the spec, forces a JSON tool/structured output, validates it with Zod, retries once on invalid JSON, then returns VENDOR_ERROR
- [ ] The Sightengine provider POSTs multipart `media` + `models=genai` + credentials to https://api.sightengine.com/1.0/check.json and maps `type.ai_generated` → score; `status !== 'success'`, HTTP ≥ 400 or a 20 s timeout → VENDOR_ERROR
- [ ] Unit tests mock only the HTTP layer (external services); no test makes a network call
- [ ] `scripts/smoke-image-vendors.ts` runs the real providers on 3 fixtures and prints the results (manual, never in CI)

## Files to Modify
- src/server/jobs/image-verification/providers/claude-car-check.provider.ts
- src/server/jobs/image-verification/providers/sightengine-ai-check.provider.ts
- src/server/jobs/image-verification/providers/index.ts: `getProviders`
- scripts/smoke-image-vendors.ts
- package.json: dependency `@anthropic-ai/sdk`

**Test files (in scope):**
- src/server/jobs/image-verification/providers/claude-car-check.provider.test.ts
- src/server/jobs/image-verification/providers/sightengine-ai-check.provider.test.ts
- src/server/jobs/image-verification/providers/index.test.ts

## Out of Scope
- The Hive provider (ADR-013)
- Threshold calibration (launch checklist)

## Implementation Plan

Step 1: Provider factory
Test 1: index.test.ts → `getProviders({ CAR_CHECK_PROVIDER: 'fake', AI_CHECK_PROVIDER: 'fake' })` returns the fake instances; `{ CAR_CHECK_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k', … }` returns ClaudeCarCheckProvider
File:   providers/index.ts

Step 2: Claude request shape + parsing
Test 2: claude-car-check.provider.test.ts (the Anthropic SDK client is injected and stubbed) → the request has model = ANTHROPIC_CAR_CHECK_MODEL, one image block `{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } }`, and a tool named `report_car_check`; a stubbed tool_use input `{ is_car: true, confidence: 0.93, view: 'exterior', is_screen_or_print: false, plate_visible: true, face_visible: false, notes: '' }` maps to CarCheckResult with isCar true
File:   claude-car-check.provider.ts

Step 3: Claude invalid output
Test 3: first response has confidence 1.7 (invalid) and the second is valid → ok after 2 calls; two invalid responses → `{ ok: false, error: { code: 'VENDOR_ERROR' } }`
File:   claude-car-check.provider.ts

Step 4: Sightengine
Test 4: sightengine-ai-check.provider.test.ts (fetch stubbed) → a request to https://api.sightengine.com/1.0/check.json with FormData fields models='genai', api_user, api_secret, media (Blob); the response `{ status: 'success', type: { ai_generated: 0.97 } }` → score 0.97; `{ status: 'failure' }` → VENDOR_ERROR; an AbortError after 20 s → VENDOR_ERROR
File:   sightengine-ai-check.provider.ts

Step 5: Smoke script
Test 5: `npx tsx scripts/smoke-image-vendors.ts --dry-run` prints the 3 fixture names and exits 0 without network access
File:   scripts/smoke-image-vendors.ts

## System Spec Constraints
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/image-verification.md:**
- Provider contracts (CarCheckResult / AiCheckResult) exactly as in the spec
- The Claude prompt: judge only what's visible; any real car part counts; toys/renders/games/trucks/buses/motorbikes/caravans/boats/loose parts don't
- EC-I11: malformed model output → retry once, then VENDOR_ERROR (counts toward attempts)

## How to Test

### Local stack + migrations
npm install

### Automated tests
npm run test -- providers

### Manual verification
1. With real keys in .env.local run `npx tsx scripts/smoke-image-vendors.ts` → car-exterior: isCar true; dog: isCar false; the AI scores are printed
2. Set CAR_CHECK_PROVIDER=claude without ANTHROPIC_API_KEY and start the job route → it fails fast with 'ANTHROPIC_API_KEY required'

## Git
- Branch: feature/019-real-image-check-providers
- Commit: feat(photos): add Claude car-check and Sightengine AI-check providers closes #019
- PR title: 019 Claude car-check and Sightengine AI-check providers
