# Issue 046: Admin settings: image-check thresholds and limits

**Epic:** E05-trust-and-moderation
**Feature:** E05-trust-and-moderation/F04-suspensions-settings-audit
**Type:** AFK
**Status:** open
**Blocked by:** #045
**Priority:** normal
**Branch:** feature/046-admin-settings

## Goal
Admins can tune the image-check thresholds and platform limits from /admin/settings, with validation and an audit trail, and the pipeline uses new values immediately.

## User Story
As an admin, I want to adjust how strict the photo checks are without a deploy.

## Reference Docs

### Structural specs
- issues/ISSUE_CONVENTIONS.md: file scope, test commands, migration naming
- docs/schema.md: app_settings (seeded keys + validation rules)
- docs/api-contracts.md: GET/PATCH /api/admin/settings
- docs/decisions.md: ADR-009

### System specs
- docs/systems/image-verification.md: EC-I8 (thresholds changed during a job)

## Acceptance Criteria
- [ ] `settings.service`: `getSettings(db)` (typed), `updateSetting(db, key, value)` validated per key: 0 < ai_review_threshold < ai_reject_threshold ≤ 1; car confidences in (0,1]; integer day/limit keys ≥ 1; min_photos ≤ max_photos ≤ 20
- [ ] Updates go through `admin_update_setting` (writes audit `settings.update` with before/after)
- [ ] /admin/settings shows every key with a description, the current value and inline validation, and explains each threshold ('Photos scoring at or above this are rejected')
- [ ] The next processed photo uses the new values (the pipeline reads at job start)

## Files to Modify
- supabase/migrations/20260928004600_admin_settings.sql: `admin_update_setting`
- src/services/settings.service.ts
- src/app/api/admin/settings/route.ts
- src/app/admin/settings/page.tsx

**Test files (in scope):**
- tests/services/settings.test.ts

## Out of Scope
- Per-shop overrides of thresholds

## Implementation Plan

Step 1: Validation
Test 1: tests/services/settings.test.ts → `updateSetting(admin, 'ai_review_threshold', 0.95)` while reject is 0.90 → VALIDATION_ERROR 'must be below ai_reject_threshold'; `'listing_expiry_days', 0` → VALIDATION_ERROR; `'max_photos', 25` → VALIDATION_ERROR
File:   settings.service.ts

Step 2: Update + audit
Test 2: `updateSetting(admin, 'ai_review_threshold', 0.6)` → ok; the admin_actions row has details { before: 0.5, after: 0.6 }; a normal user → FORBIDDEN
File:   migration, settings.service.ts

Step 3: Pipeline uses new values
Test 3: set ai_review_threshold 0.75, then process borderline-ai.jpg (score 0.70) → passed (previously in_review)
File:   (integration through the existing pipeline)

Step 4: Page + route
Test 4: PATCH `{ key: 'nope', value: 1 }` → 422; the page shows the threshold hint texts
File:   route, page

## How to Test

### Local stack + migrations
npx supabase start && npx supabase db reset && cp .env.example .env.local (fill keys from `npx supabase status`) && npm run dev

### Automated tests
npm run test:integration -- settings

### Manual verification
1. In /admin/settings set the AI review threshold to 0.75 → upload borderline-ai.jpg → it passes
2. Try review 0.95 → an inline error

## Git
- Branch: feature/046-admin-settings
- Commit: feat(admin): add admin settings for thresholds and limits closes #046
- PR title: 046 Admin settings: image-check thresholds and limits
