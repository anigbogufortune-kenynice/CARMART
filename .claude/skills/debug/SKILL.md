---
name: debug
description: Diagnose a failing test or type error when the agent gets stuck. Identifies root cause, states a hypothesis, lists likely files, proposes a minimal fix, and waits for approval before applying it. Use when an agent has run for 10+ minutes without progress or has the same test failing repeatedly.
---

# Skill: Debug

## Instructions
1. Read the error output.
2. Identify root cause — do not fix yet.
3. State hypothesis in one sentence.
4. List 2–3 files most likely involved.
5. Propose the minimal change that fixes it.
6. Show the exact diff.
7. Ask: "Shall I apply this fix?"
8. After approval, make only that change and re-run feedback loop.
9. If still failing, restart from step 1.

## Do not
- Make multiple changes at once
- Refactor unrelated code
- Dismiss the error as "probably fine"
