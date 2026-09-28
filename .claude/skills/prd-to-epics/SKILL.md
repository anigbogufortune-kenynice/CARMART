---
name: prd-to-epics
description: Break a PRD into 2-5 independently releasable epics. Each epic is a user-facing capability area, not a technical layer. Use after spec docs are locked. Reject horizontal slicing like database epic or API epic.
---

# Skill: PRD to Epics

## Instructions
1. Read the PRD and the docs/ spec documents.
2. Identify 2–5 major user-facing capability areas.
3. For each epic: summary, feature list (titles only), blocking relationships.
4. Ask: "Does this breakdown look right?"
5. On approval, write to `issues/epics/E[N]-[slug].md`

## Rules
- Independently releasable — tightly coupled epics should merge
- Maximum 5 per PRD — split the PRD if more are needed
- Not technical layers (never "database epic" or "API epic")
