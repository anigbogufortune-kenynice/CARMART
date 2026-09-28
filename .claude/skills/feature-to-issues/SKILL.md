---
name: feature-to-issues
description: Break a feature into 1-4 atomic issues with detailed TDD implementation plans and explicit references to the docs spec files. Each issue gets exact file paths to modify and step-by-step test assertions. Automatically detects which system specs in docs/systems/ are relevant and adds them to the issue Reference Docs and a System Spec Constraints section. Use when ready to convert a feature into agent work orders.
---

# Skill: Feature to Issues

## Instructions

1. Read the feature file, parent epic, PRD module map, all files in docs/,
   and all files in docs/systems/ (if the folder exists).
2. Detect system spec relevance — for each system spec in docs/systems/,
   determine if the feature touches that system. A feature touches a system if:
   - It modifies a table in that system's Data Requirements
   - It calls a route in that system's API Surface
   - It implements or changes a state transition
   - It enforces or relies on a business rule or invariant from that system
3. Explore the codebase — identify exact files that will change.
4. Draft 1–4 issues using the full template below.
5. Ask: "Is each issue completable in one agent session?"
6. On approval, write to issues/open/[NNN]-[slug].md

## Full Issue Template

# Issue [NNN]: [Title]

**Epic:** E[N]-[slug]
**Feature:** F[N]-[slug]
**Type:** AFK | Human-in-loop
**Status:** open
**Blocked by:** #[NNN] | nothing
**Priority:** critical | high | normal | low
**Branch:** feature/[NNN]-[slug]

## Goal
One sentence: what does done look like from a user's perspective?

## User Story
As a [user type], I want [action] so that [outcome].

## Reference Docs

### Structural specs
- docs/schema.md — [which tables/columns apply]
- docs/api-contracts.md — [which routes apply]
- docs/auth.md — [if auth is involved]

### System specs
Include ONLY system specs this issue actually touches.
Remove this section if no system specs exist or none apply.
- docs/systems/[system-slug].md — [which states/transitions/rules apply]

## Acceptance Criteria
- [ ] [mirrors Test 1 outcome]
- [ ] [mirrors Test 2 outcome]

## Files to Modify
- src/services/[name].service.ts — [what changes]
- supabase/migrations/[ts]_[name].sql — [what changes]
- src/app/api/[route]/route.ts — [what changes]
- src/components/[Name].tsx — [what the user sees]

## Out of Scope
- [what is NOT in this issue]

## Implementation Plan

Step 1: [what to build]
Test 1: [exact assertion the test will make]
File:   [test file + implementation file]

Step 2: [what to build]
Test 2: [exact assertion]
File:   [files]

## System Spec Constraints
Only include when the issue touches a system spec. Remove otherwise.
The agent MUST read the referenced system specs before writing any code.

**From docs/systems/[system-slug].md:**
- State transitions this issue implements: [e.g. draft to pending on submit]
- Guards that must be enforced: [e.g. actor is owner AND all fields filled]
- Invariants that must hold: [e.g. INV-001: cannot reach active without both parties agreeing]
- Edge cases this issue must handle: [e.g. EC-001: concurrent modification returns 409]
- Implementation notes: [copy relevant notes from the system spec]

## How to Test
Required when the issue introduces or modifies any of:
- a database migration
- a new or changed HTTP route
- a new or changed UI surface
- a new background queue or processor

Omit only for pure refactors, doc-only changes, or internal plumbing
that has no externally observable effect.

scripts/worktree-merge.sh extracts the `### Manual verification`
sub-section verbatim into the post-merge phase checklist — keep the
heading text exact.

### Local stack + migrations
Commands the human runs to get a local environment ready to test this
issue after merge (docker compose start, migration command, seed data).

### Automated tests
The exact command(s) that run the new tests, plus the expected pass
count delta (e.g. "X new tests added; full suite Y/Y pass").

### Manual verification
A numbered list of HTTP requests, UI clicks, or CLI checks the human
performs against the local stack to confirm the merged code behaves as
described. Each step states the exact input and the expected response
or visible state.

## Git
- Branch: feature/[NNN]-[slug]
- Commit: feat([scope]): [description] closes #[NNN]
- PR title: [NNN] [Title]

## System spec detection rules

Include a system spec if the issue:
- Adds or modifies a route in that system's API Surface
- Adds or modifies a column in that system's Data Requirements
- Implements any row in the Transition Table
- Enforces a guard, invariant, or business rule from the spec
- Handles an edge case from the spec's Edge Cases table

When in doubt, include it. Missing a constraint is costlier than
reading an extra spec.

## Implementation Plan rules
- Every acceptance criterion maps to at least one step
- Every step has a test that fails before implementation
- Tests reference exact function names, inputs, and expected outputs
- Order: schema then service then route then UI
- Final step produces something visible or integration-testable
- When touching a system spec: first step is always to read the full spec
- Every invariant in System Spec Constraints needs its own test
- Every edge case in System Spec Constraints needs its own test
- When the issue touches a migration, route, UI surface, or queue/processor:
  include a `## How to Test` section with all three sub-headings
  (`### Local stack + migrations`, `### Automated tests`,
  `### Manual verification`). The `### Manual verification` heading is
  parsed verbatim by scripts/worktree-merge.sh — do not paraphrase it.

## Sizing
- More than 6 files to modify: split
- No visible output: merge into next issue
- More than 5 steps: consider splitting
- More than 3 invariants or edge cases: consider splitting
