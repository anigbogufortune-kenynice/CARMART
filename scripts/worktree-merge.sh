#!/usr/bin/env bash
# worktree-merge.sh — clean up Phase N worktrees after GitHub PRs are merged.
# Also applies any newly merged DB migrations (if configured) and writes a
# manual-verification checklist for the phase.
# Usage: ./scripts/worktree-merge.sh [phase-number]
# Run AFTER all Phase N PRs are reviewed and merged on GitHub.
#
# Migration hook: set MIGRATE_CMD env var (e.g. "pnpm prisma migrate deploy"
# or "rails db:migrate") OR add an executable scripts/migrate.sh. Missing
# both = migrations are skipped with a warning.

# NOTE: No set -e — errors handled explicitly

PHASE="${1}"
WORKTREE_BASE="$(pwd)/.worktrees"
MERGE_LOG="issues/merge-log.md"
APP_ROOT="$(pwd)"

if [ -z "$PHASE" ]; then
  echo "Usage: ./scripts/worktree-merge.sh [phase-number]"
  exit 1
fi

PHASE_BRANCHES=$(awk "/^## Phase $PHASE /,/^## Phase [0-9]|^## Human/" \
  issues/EXECUTION_PLAN.md \
  | grep "^\| [0-9]" \
  | awk -F'|' '{gsub(/ /,"",$4); print $4}' \
  | grep "^feature/")

if [ -z "$PHASE_BRANCHES" ]; then
  echo "No branches found for Phase $PHASE in EXECUTION_PLAN.md"
  exit 1
fi

git checkout main && git pull

# Apply any new migrations that landed in the merged PRs. Non-fatal: PRs are
# already merged on GitHub, so cleanup must still proceed even if the DB
# isn't reachable. The phase checklist surfaces the outcome.
if [ -n "$MIGRATE_CMD" ]; then
  MIGRATE_HOOK="$MIGRATE_CMD"
elif [ -x "$APP_ROOT/scripts/migrate.sh" ]; then
  MIGRATE_HOOK="$APP_ROOT/scripts/migrate.sh"
else
  MIGRATE_HOOK=""
fi

if [ -z "$MIGRATE_HOOK" ]; then
  MIGRATE_STATUS="skipped (set MIGRATE_CMD env var or add scripts/migrate.sh)"
  echo "⚠  $MIGRATE_STATUS"
else
  echo "Applying pending migrations: $MIGRATE_HOOK"
  if eval "$MIGRATE_HOOK"; then
    MIGRATE_STATUS="applied"
  else
    MIGRATE_STATUS="FAILED — re-run: $MIGRATE_HOOK"
    echo "⚠  migration hook failed — continuing with cleanup"
  fi
fi

CLEANED=()
SKIPPED=()

for BRANCH in $PHASE_BRANCHES; do
  SLUG="${BRANCH#feature/}"
  NNN="${SLUG%%-*}"
  WORKTREE_PATH="${WORKTREE_BASE}/${SLUG}"

  REMOTE_EXISTS=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REMOTE_EXISTS" -gt 0 ]; then
    echo "⚠  $BRANCH still open on GitHub — skipping"
    SKIPPED+=("$BRANCH")
    continue
  fi

  [ -d "$WORKTREE_PATH" ] && git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
  git branch -D "$BRANCH" 2>/dev/null || true

  ISSUE_FILE=$(ls "$APP_ROOT/issues/open/${NNN}"-*.md 2>/dev/null | head -1)
  if [ -n "$ISSUE_FILE" ]; then
    mv "$ISSUE_FILE" "$APP_ROOT/issues/done/$(basename $ISSUE_FILE)"
  fi
  CLEANED+=("$BRANCH")
done

cd "$APP_ROOT"
[ -n "$(git status --short issues/ 2>/dev/null)" ] && \
  git add issues/ && git commit -m "chore: close Phase $PHASE issues after PR merge"

DATE=$(date '+%Y-%m-%d %H:%M')
[ ! -f "$MERGE_LOG" ] && \
  printf "# Merge Log\n\n| Date | Phase | Branch | Status |\n|---|---|---|---|\n" > "$MERGE_LOG"
for B in "${CLEANED[@]}"; do
  printf "| %s | Phase %s | %s | merged |\n" "$DATE" "$PHASE" "$B" >> "$MERGE_LOG"
done

git add "$MERGE_LOG" 2>/dev/null && git commit -m "chore: update merge log Phase $PHASE" 2>/dev/null || true
git push 2>/dev/null || true
git worktree prune

# Build the per-phase manual verification checklist from each merged issue's
# `### Manual verification` section. Issues without the section are listed
# with a hint to fall back to their Acceptance Criteria.
CHECKLIST_FILE=""
if [ ${#CLEANED[@]} -gt 0 ]; then
  mkdir -p "$WORKTREE_BASE"
  CHECKLIST_FILE="${WORKTREE_BASE}/phase-${PHASE}-manual-verification.md"
  {
    printf '# Phase %s — Manual Verification Checklist\n\n' "$PHASE"
    printf 'Run these recipes against your local stack before kicking off Phase %s.\n\n' "$((PHASE + 1))"
    printf 'Migration status: %s\n\n' "$MIGRATE_STATUS"
    printf -- '---\n\n'
    for B in "${CLEANED[@]}"; do
      SLUG="${B#feature/}"
      NNN="${SLUG%%-*}"
      ISSUE_FILE=$(ls "$APP_ROOT/issues/done/${NNN}"-*.md 2>/dev/null | head -1)
      [ -z "$ISSUE_FILE" ] && continue

      TITLE=$(head -1 "$ISSUE_FILE" | sed 's/^# *//')
      printf '## %s\n\n' "$TITLE"
      printf 'Source: `%s`\n\n' "issues/done/$(basename "$ISSUE_FILE")"

      RECIPE=$(awk '/^### Manual verification/{flag=1; next} flag && /^## /{flag=0} flag' "$ISSUE_FILE")
      if [ -n "$RECIPE" ]; then
        printf '%s\n\n' "$RECIPE"
      else
        printf '_No `### Manual verification` section in this issue. Walk the Acceptance Criteria manually._\n\n'
      fi
    done
  } > "$CHECKLIST_FILE"
fi

echo ""
echo "✓ Cleaned: ${#CLEANED[@]}"
[ ${#SKIPPED[@]} -gt 0 ] && echo "⚠ Skipped (PRs not merged): ${#SKIPPED[@]}"
echo "  Migrations: $MIGRATE_STATUS"
[ -n "$CHECKLIST_FILE" ] && echo "  Checklist:  $CHECKLIST_FILE"

NEXT=$((PHASE + 1))
if grep -q "^## Phase $NEXT" issues/EXECUTION_PLAN.md 2>/dev/null; then
  echo ""
  echo "Next:"
  [ -n "$CHECKLIST_FILE" ] && echo "  1. Walk $CHECKLIST_FILE against your local stack"
  echo "  $([ -n "$CHECKLIST_FILE" ] && echo "2. " || echo "1. ")./scripts/worktree-run.sh $NEXT"
else
  echo "All phases complete."
  [ -n "$CHECKLIST_FILE" ] && echo "Final manual verification: $CHECKLIST_FILE"
fi
