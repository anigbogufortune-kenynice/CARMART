---
name: grill-me
description: Interview the user relentlessly about a feature until shared understanding is reached. Use before writing any PRD or plan. Asks one question at a time, suggests recommended answers, walks through data model, business logic, UX, integration points, out of scope, and testing strategy.
---

# Skill: Grill Me

## Purpose
Reach a shared design concept before any planning or code. Do not produce
a plan or document until the user says "write the PRD" or "done".

## Instructions
1. Use a sub-agent to explore the codebase silently first. Report a
   3-bullet summary of relevant existing code.
2. Ask exactly ONE question at a time.
3. For every question, provide your recommended answer.
4. Cover at minimum:
   - Data model: new Supabase tables, columns, relationships, RLS policies
   - Business logic: edge cases, validation rules, error states
   - User experience: what the user sees and when
   - Integration points: which existing services/components are affected
   - Out of scope: what we are explicitly NOT doing in this session
   - Testing strategy: how we will know it works
5. Continue until the user types "done" or "write the PRD".
6. Do not summarise or write a plan mid-session.

## Tone
Direct and relentless. Surface uncomfortable assumptions.
Push back on vague answers.
