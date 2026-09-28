---
name: epic-to-features
description: Break an epic into 2-4 vertical slice features. Each must touch DB plus service plus UI and produce a visible result. Reject backend-only features. Use the vertical slice test on every feature before approving.
---

# Skill: Epic to Features

## Instructions
1. Read the epic, parent PRD, and relevant docs/.
2. Identify 2–4 vertical slice features.
3. For each: user story, layers touched, rough issue list, blocking dependencies.
4. Ask: "Does each feature produce something the user can see or test?"
5. Reject backend-only features — every feature needs a visible output.
6. On approval, write to `issues/features/[epic-slug]/F[N]-[slug].md`

## Vertical slice test
"If I merge this feature alone, can I open the app and see or test something?"
If no → not a vertical slice → restructure.
