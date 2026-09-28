---
name: write-specs
description: Generate spec documents in docs/ from a confirmed PRD. Use after PRD is confirmed, before /prd-to-epics. Drafts schema.md, api-contracts.md, auth.md, architecture.md, decisions.md, and env.md from PRD content. Marks unknowns as TODO placeholders for the developer to fill in.
---

# Skill: Write Specs

## Purpose
Turn PRD architectural decisions into spec documents the agent references
during every implementation session. Run AFTER PRD is confirmed, BEFORE /prd-to-epics.

## Instructions
1. Read the PRD file.
2. Draft each spec doc below from PRD content only.
3. Mark unknown sections: `<!-- TODO: fill in before epics are created -->`
4. Save each to `docs/[name].md`.
5. List every placeholder needing attention.
6. Ask: "Please review and fill in placeholders before running /prd-to-epics."

## Documents to generate

### docs/schema.md
For every table: name, purpose, all columns (name/type/nullable/default/description),
indexes, foreign keys, RLS policies (operation/role/condition).

### docs/api-contracts.md
For every route: method+path, auth requirement, Zod request schema,
success response shape + status, all error responses + status, example pair.

### docs/auth.md
Auth method, sign up/in/out flows, session handling, role definitions,
RLS policy summary, protected routes list.

### docs/architecture.md
System overview paragraph, services map (name/file/responsibility),
data flow (request lifecycle), external integrations, deployment overview.

### docs/decisions.md
For each Grill Me decision: title, context, choice, rationale, consequences.

### docs/env.md
Every environment variable: name, required/optional, description, example value,
where used. Include Zod startup validation example.

## Rules
- Write only what the PRD contains — do not invent
- Placeholders for unknowns — never guess
- Once reviewed and locked, agent treats them as read-only source of truth
