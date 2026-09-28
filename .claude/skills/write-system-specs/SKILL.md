---
name: write-system-specs
description: Analyse the PRD and existing spec docs to identify every complex stateful system in the app, then generate a detailed behavioural specification for each one in docs/systems/. Each spec contains a state machine (with Mermaid diagram), transition table, business rules and invariants, sequence diagrams for happy/alternate/error paths, edge cases, data requirements, and API surface. Run after /write-specs and before /prd-to-epics so agents can reference exact system behaviour during implementation.
---

# Skill: Write System Specs

## Purpose

Structural spec docs (schema, API contracts, architecture) tell the agent
WHAT exists. System specs tell the agent HOW each complex system behaves —
the states it moves through, the rules that govern transitions, the
sequences of calls, and the edge cases that must be handled correctly.

Without system specs, agents implementing complex systems (negotiation
engines, payment flows, booking systems, approval workflows, real-time
sync) make plausible-but-wrong assumptions about behaviour. System specs
eliminate that ambiguity before implementation starts.

Run AFTER `/write-specs` and BEFORE `/prd-to-epics`.

---

## Step 1 — Identify systems that need specs

Read the PRD and all docs/ files. A system needs a spec if it is:
- **Stateful** — has distinct states with defined transitions
- **Multi-actor** — involves more than one user role or service
- **Rule-governed** — has business rules constraining what happens when
- **Financially sensitive** — involves money, credits, or commitments
- **Temporally complex** — involves timers, deadlines, expiry, scheduling
- **Conflict-prone** — multiple users can act on the same entity

Systems that do NOT need specs: simple CRUD, static display, basic search.

List identified systems and ask the user to confirm before proceeding.

---

## Step 2 — Generate one spec file per system

Create `docs/systems/[system-slug].md` for each confirmed system.
Use the full template below. Every section is mandatory.
Mark anything not in the PRD as: `<!-- TODO: define before implementation starts -->`

Never invent behaviour. Only document what the PRD states or implies.

---

## Template

# System Spec: [System Name]

> Source: issues/prd-[name].md
> Status: draft — confirm all TODOs before /prd-to-epics

## Overview
[2–3 sentences. What does this system do? Who are the actors?]

**Actors:**
| Actor | Role |
|---|---|
| [User type] | [what they do] |

## State Machine

### States
| State | Description | Who can be in this state |
|---|---|---|
| `draft` | | |

### Mermaid diagram
\`\`\`mermaid
stateDiagram-v2
    [*] --> draft: created
    draft --> pending: submitted [guard]
    pending --> active: accepted [guard]
    pending --> cancelled: rejected
    active --> completed: fulfilled [guard]
    active --> cancelled: cancelled [guard]
    completed --> [*]
    cancelled --> [*]
\`\`\`

### Transition table
| From | Event | Guard (must be true) | Action | To |
|---|---|---|---|---|
| `draft` | `submit` | owner AND all fields filled | notify counterparty | `pending` |

### Terminal states
List which states have no further transitions and why.

## Business Rules and Invariants

### Hard invariants (never violate)
- [ ] **INV-001:** [condition that is always true]

### Business rules (enforced per operation)
| Rule ID | Rule | Enforced at | Error if violated |
|---|---|---|---|
| BR-001 | | service layer | |

### Computed values
| Value | How calculated | When recalculated |
|---|---|---|

## Sequence Diagrams

### Happy path
\`\`\`mermaid
sequenceDiagram
    actor User
    participant API
    participant DB
    participant Notifications
    User->>API: action
    API->>DB: write
    API->>Notifications: notify
    API-->>User: response
\`\`\`

### Alternative path
[Counter-offer, retry, partial success, etc.]

### Error path
[Expiry, concurrent modification, payment failure, etc.]

## Edge Cases

| ID | Scenario | How it arises | Required behaviour | Error returned |
|---|---|---|---|---|
| EC-001 | Concurrent modification | Race condition | Optimistic lock, 409 | `CONCURRENT_MODIFICATION` |

## Data Requirements

Cross-reference docs/schema.md — every field here must exist there.

| Field | Table | Type | Purpose | Indexed? |
|---|---|---|---|---|

## API Surface

Cross-reference docs/api-contracts.md — every route here must be fully specified there.

| Method | Path | Actor | Description |
|---|---|---|---|

## Implementation Notes for the Agent

- Always use a DB transaction when transitioning state
- Check guard conditions in the service layer, not the route handler
- Version field is mandatory — increment on every state transition
- Cron jobs must be idempotent

## Open Questions

| # | Question | Needed by | Status |
|---|---|---|---|
| 1 | | | <!-- TODO --> |
