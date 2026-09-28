#!/usr/bin/env bash
# ralph.sh — sequential AFK loop, used as fallback when worktrees aren't suitable

# NOTE: No set -e — errors handled explicitly

echo ""
echo "=== Ralph loop starting ==="
echo "Open issues: $(ls issues/open/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo ""

ITERATION=0
PROMPT=$(awk '/^---/{i++} i>=2{print} i<2 && /^---/{next}' \
  .claude/skills/implement/SKILL.md 2>/dev/null || echo "skill not found")

while true; do
  ITERATION=$((ITERATION + 1))
  echo "--- Iteration $ITERATION ---"

  ISSUES=$(cat issues/open/*.md 2>/dev/null || echo "")
  EPICS=$(cat issues/epics/*.md 2>/dev/null || echo "")
  FEATURES=$(find issues/features -name "*.md" 2>/dev/null | xargs cat 2>/dev/null || echo "")
  COMMITS=$(git log --oneline -5 2>/dev/null || echo "")

  if [ -z "$ISSUES" ]; then
    echo "No open issues. Stopping."
    break
  fi

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

  OUTPUT=$(echo "$FULL_PROMPT" | claude --permission-mode acceptEdits -p)

  echo "$OUTPUT"
  echo ""

  if echo "$OUTPUT" | grep -q "\[NO MORE TASKS\]"; then
    echo "=== All tasks complete. ==="
    break
  fi

  if echo "$OUTPUT" | grep -q "\[BLOCKED"; then
    echo "=== Agent blocked. Review issues/open/ and rerun. ==="
    break
  fi

  sleep 5
done
