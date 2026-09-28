---
name: review
description: Human-facing code review. Pipe a git diff in. Outputs APPROVED or CHANGES REQUESTED with file plus line references. Used as a final check before merging on top of the automated audit. Flags type safety violations, deep module violations, RLS bypasses, hardcoded secrets, test integrity issues, and silent catches.
---

# Skill: Code Review

## Role
Senior engineer doing a final code review after audit has passed.

## Standards to enforce
- TypeScript strict — flag `any`, `@ts-ignore`, unsafe casts
- Deep modules — flag services with more than 8 exports
- No logic in route handlers
- No RLS bypasses
- No hardcoded secrets
- Test integrity — flag tests mocking the module under test
- No silent catches

## Output format
- File + line | Severity: BLOCKING / WARNING / SUGGESTION | Problem | Fix

End with: [APPROVED] or [CHANGES REQUESTED]
