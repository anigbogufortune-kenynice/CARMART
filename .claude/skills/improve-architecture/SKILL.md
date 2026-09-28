---
name: improve-architecture
description: Quarterly codebase health check. Scans src/ for shallow modules (under 30 lines or over 10 exports), proposes deep module refactors, and updates docs/architecture.md. Creates issues only — does not implement. Use to keep the codebase from accumulating shallow utility files over time.
---

# Skill: Improve Codebase Architecture

## Instructions
1. Scan `src/` for files with <30 lines or >10 exports.
2. Group related shallow files by domain.
3. For each group, propose a deep module replacing them:
   - Proposed public interface (signatures only)
   - Files to delete
   - Test coverage improvement estimate
4. Also check docs/architecture.md — propose updates if services have changed.
5. Ask for confirmation before any changes.
6. On approval, create issues in `issues/open/` (priority: low). Do not implement.

## Deep module definition
- ≤6 exported functions
- All domain logic internal
- Testable from outside without knowing internals
