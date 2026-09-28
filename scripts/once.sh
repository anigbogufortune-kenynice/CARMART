#!/usr/bin/env bash
# once.sh — run one agent pass with full hierarchy context
# Use this to verify the loop works before running worktree-run.sh

# NOTE: No set -e — errors handled explicitly

ISSUES=$(cat issues/open/*.md 2>/dev/null || echo "No open issues found.")
EPICS=$(cat issues/epics/*.md 2>/dev/null || echo "")
FEATURES=$(find issues/features -name "*.md" 2>/dev/null | xargs cat 2>/dev/null || echo "")
COMMITS=$(git log --oneline -5 2>/dev/null || echo "No commits yet.")
PROMPT=$(awk '/^---/{i++} i>=2{print} i<2 && /^---/{next}' \
  .claude/skills/implement/SKILL.md 2>/dev/null || echo "skill not found")

ISSUE_COUNT=$(ls issues/open/*.md 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "=== Single agent pass ==="
echo "Open issues: $ISSUE_COUNT"
echo ""

FULL_PROMPT="$PROMPT

---
RECENT COMMITS:
$COMMITS

---
EPICS:
$EPICS

---
FEATURES:
$FEATURES

---
ISSUES:
$ISSUES"

echo "$FULL_PROMPT" | claude --permission-mode acceptEdits -p
