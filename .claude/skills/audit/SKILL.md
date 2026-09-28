---
name: audit
description: Post-implementation audit run in a fresh context after a worktree finishes. Checks TDD integrity, spec compliance, security, error handling, performance, coding standards, and scope discipline. Outputs structured PASS/FAIL report with blocking issues. PR is only opened after audit returns APPROVED.
---

# Skill: Implementation Audit

Run in a FRESH context (not the implementing session).

## How to invoke
```bash
ISSUE_FILE=$(cat issues/open/NNN-slug.md)
SPECS=$(cat docs/*.md)
DIFF=$(git diff main...feature/NNN-slug)

{
  cat .claude/skills/audit/SKILL.md
  echo ""
  echo "---"
  echo "ISSUE:"
  echo "$ISSUE_FILE"
  echo ""
  echo "SPEC_DOCS:"
  echo "$SPECS"
  echo ""
  echo "DIFF:"
  echo "$DIFF"
} | claude -p > ../.worktrees/NNN-slug.audit.log
```

## Audit Sections

### 1. TDD Integrity
- Test exists for every acceptance criterion?
- Test exists for every Implementation Plan step?
- Tests exercise real code (no mocking the module under test)?
- Removing implementation would cause tests to fail?

### 2. Spec Compliance
- New routes match docs/api-contracts.md (method, path, response shape)?
- New columns match docs/schema.md?
- Auth handling matches docs/auth.md?
- Spec docs modified without issue instruction?

### 3. Security
- All new API inputs validated with Zod?
- Auth check present in every new route handler?
- RLS untouched (no service role bypass)?
- Secrets via env vars only?
- Internal errors hidden from API responses?

### 4. Error Handling
- Services return Result<T, AppError>?
- Catch blocks log+rethrow OR handle+return (never swallow)?
- All errors: `{ error: { code, message } }`?

### 5. Performance
- Any `select('*')` queries? (flag file:line)
- Any N+1 patterns?
- Independent async using Promise.all?
- RSC used where client components not needed?

### 6. Coding Standards
- Any `any`, `@ts-ignore`, unsafe casts?
- Any `console.log`?
- Naming conventions followed?
- No unused imports/variables?

### 7. Scope Discipline
- Files outside ## Files to Modify touched?
- Existing tests deleted or weakened?
- Functionality added beyond acceptance criteria?

## Output Format

```
## Audit Report — Issue #[NNN]: [Title]
Branch: feature/[NNN]-[slug]

### 1. TDD Integrity        [PASS / FAIL]
### 2. Spec Compliance      [PASS / FAIL]
### 3. Security             [PASS / FAIL]
### 4. Error Handling       [PASS / FAIL]
### 5. Performance          [PASS / FAIL]
### 6. Coding Standards     [PASS / FAIL]
### 7. Scope Discipline     [PASS / FAIL]

Overall: [APPROVED / CHANGES REQUIRED]

Blocking issues:
- [file:line — problem — fix required]

Warnings:
- [suggestion]
```

Fix all blocking issues, re-run audit, then open PR.
