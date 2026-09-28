# Agent Instructions: CarMart

## Role
You are an autonomous coding agent working on CarMart. You implement
issues one at a time using strict test-driven development. You work from the
issue file, its parent context files, and the referenced spec docs.

## Skills
Custom skills are in `.claude/skills/<name>/SKILL.md` (Codex reads them via
the `.codex/skills` symlink to the same location). Invoke a skill by typing
its name as a slash command (e.g. `/implement`, `/audit`, `/debug`).

## Stack
- Next.js 14 (App Router) + React 18
- Supabase (Postgres, Auth, Storage)
- TypeScript strict mode
- Vitest + Testing Library
- Tailwind CSS

## How to start each task
1. Read the issue file
2. Read the parent Feature file (sibling context)
3. Read the parent Epic file (broader goal)
4. Read each spec doc in ## Reference Docs
5. Explore ONLY files in ## Files to Modify — 3-bullet summary
6. Create branch: `git checkout -b [branch from ## Git section]`
7. Execute ## Implementation Plan step by step (strict TDD)
8. Run full feedback loop
9. Run self-audit
10. Commit + push

## TDD Protocol (mandatory, no exceptions)
For every step in ## Implementation Plan:
  a. Write the test for that step
  b. Run npm run test — confirm FAIL with expected error
  c. Write minimum implementation to pass
  d. Run npm run test — confirm PASS, no regressions
  e. Move to next step

## Hard Rules
- Never modify files outside ## Files to Modify
- Spec docs are read-only unless the issue says to update them
- Never delete existing tests
- No `any`, `@ts-ignore`, or unsafe casts
- No RLS bypass — no service role in app code (sole exception: `src/server/jobs/**`, ADR-006)
- No hardcoded secrets
- Bugs found outside scope → write to issues/discovered/ and continue
- Cannot complete without out-of-scope changes → output [BLOCKED: reason]

## Feedback Loop (before every commit)
1. npm run test
2. npm run type-check
3. npm run lint
All must pass. Fix failures before committing.

## Self-Audit (before every push)
Output PASS or FAIL per item. Fix all FAIL before pushing.
- [ ] Every acceptance criterion has a passing test
- [ ] No files modified outside ## Files to Modify
- [ ] No `any`, `@ts-ignore`, or unsafe casts
- [ ] No hardcoded secrets
- [ ] All new API inputs validated with Zod
- [ ] Error handling follows Result<T, AppError> pattern
- [ ] No `select('*')` queries
- [ ] RLS not bypassed
- [ ] No `console.log` in committed code
- [ ] API shapes match docs/api-contracts.md
- [ ] DB columns match docs/schema.md
- [ ] Spec docs unchanged (unless issue instructs update)

## When all tasks are done
Output exactly: [NO MORE TASKS]
