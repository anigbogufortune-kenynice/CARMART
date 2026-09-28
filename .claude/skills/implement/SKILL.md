---
name: implement
description: Implement one issue from the backlog using strict step-by-step TDD. Reads epic and feature for orientation, reads referenced spec docs, executes the implementation plan one step at a time with red-green-refactor, runs feedback loops, performs self-audit, commits, and pushes. Use as the AFK loop prompt for worktree-run.sh.
---

# Agent Task: Implement Issue

You are an autonomous coding agent. Implement exactly one issue from the
backlog using strict test-driven development, one step at a time.

## Setup
Open issues are in the ISSUES section. Epics in EPICS. Features in FEATURES.
Pick the highest-priority issue that has no incomplete blockers.
If all AFK issues are complete, output exactly: [NO MORE TASKS]

## Priority order
1. Critical bug fixes
2. Development infrastructure (tooling, CI, test setup)
3. Tracer bullet issues (first end-to-end slice)
4. Remaining feature issues in blocking order
5. Polish, refactors, quick wins

## Step 1 — Orient and branch

Read the issue. Note Epic, Feature, and Reference Docs fields.
- Read the matching Epic file from EPICS
- Read the matching Feature file from FEATURES
- Read each doc in ## Reference Docs (source of truth — match exactly)

```
git checkout main && git pull
git checkout -b [branch from ## Git section]
```

## Step 2 — Explore

Read only files in ## Files to Modify. 3-bullet summary.
Scope = Files to Modify only. Epic/Feature/docs = orientation only.

## Step 3 — Execute Implementation Plan (strict TDD, no skipping)

For each Step N in ## Implementation Plan:

a. Write Test N as described
b. `npm run test` → MUST fail with expected error
   (if passes before implementation → test is wrong → fix it)
c. Write minimum code to pass Test N
d. `npm run test` → Test N passes, no regressions
e. Output: `✓ Step N complete — Tests: [before] → [after]`
f. Next step

Do not jump ahead. Do not implement beyond the current step.

## Step 4 — Full feedback loop

```
npm run test
npm run type-check
npm run lint
```
All must pass.

## Step 5 — Self-audit

Output PASS or FAIL per item. Fix all FAIL before committing.

- [ ] Every acceptance criterion has a passing test
- [ ] No files outside ## Files to Modify touched
- [ ] No `any`, `@ts-ignore`, or unsafe casts
- [ ] No hardcoded secrets
- [ ] All new API inputs validated with Zod
- [ ] Errors follow Result<T, AppError> pattern
- [ ] No `select('*')` queries
- [ ] RLS not bypassed
- [ ] No `console.log` in committed code
- [ ] API shapes match docs/api-contracts.md
- [ ] DB columns match docs/schema.md
- [ ] Spec docs unchanged (unless issue instructs update)

## Step 6 — Commit and push

```
feat([scope]): [description] closes #[NNN]
git push -u origin [branch-name]
```

Output:
- What was implemented (2–3 sentences)
- Steps completed: N/N
- Tests: [before] → [after]
- Self-audit: all PASS / [items fixed]
- Branch: feature/[NNN]-[slug]
- Discovered issues: [list or none]

## Hard constraints
- Never modify files outside ## Files to Modify
- Spec docs read-only unless issue says to update
- Never delete tests | No `any` | No RLS bypass
- [BLOCKED: reason] if blocked

---
EPICS:
[injected]

---
FEATURES:
[injected]

---
ISSUES:
[injected]
