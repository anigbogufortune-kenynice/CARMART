#!/usr/bin/env bash
# sync-merged-issues.sh — move issue files from issues/open/ to issues/done/
# for any issue whose closing commit is reachable from origin/main.
#
# Use this when:
#   - a PR was merged outside the AFK worktree flow (human-in-loop merge)
#   - worktree-merge.sh was skipped for a phase
#   - you want to backfill the open/done split after the fact
#
# Run from the main repo root (not from a worktree). Safe to run repeatedly.
#
# Usage: ./scripts/sync-merged-issues.sh

# NOTE: No set -e — errors handled explicitly

APP_ROOT="$(pwd)"
OPEN_DIR="$APP_ROOT/issues/open"
DONE_DIR="$APP_ROOT/issues/done"

if [ ! -d "$OPEN_DIR" ]; then
  echo "issues/open/ not found — run this from the repo root."
  exit 1
fi

git fetch origin main --quiet 2>/dev/null || true

REF="origin/main"
git rev-parse --verify "$REF" >/dev/null 2>&1 || REF="main"

# Pull every "closes #NNN" / "fixes #NNN" / "resolves #NNN" reference from
# commits reachable from main. GitHub auto-close keywords are matched
# case-insensitively, with optional past-tense suffixes.
MERGED_IDS=$(git log "$REF" --pretty=%B \
  | grep -oiE '(close[sd]?|fix(e[sd])?|resolve[sd]?) #[0-9]+' \
  | grep -oE '[0-9]+' \
  | sort -u)

if [ -z "$MERGED_IDS" ]; then
  echo "No 'closes #NNN' references found on $REF."
  exit 0
fi

mkdir -p "$DONE_DIR"
MOVED=()

for NNN in $MERGED_IDS; do
  # 10# forces base-10 so leading-zero IDs like 032 don't become octal 26.
  PADDED=$(printf '%03d' "$((10#$NNN))")
  ISSUE_FILE=$(ls "$OPEN_DIR/${PADDED}"-*.md 2>/dev/null | head -1)
  [ -z "$ISSUE_FILE" ] && continue

  TARGET="$DONE_DIR/$(basename "$ISSUE_FILE")"
  mv "$ISSUE_FILE" "$TARGET"
  MOVED+=("$(basename "$TARGET")")
done

if [ ${#MOVED[@]} -eq 0 ]; then
  echo "All merged issues are already in done/. Nothing to move."
  exit 0
fi

echo "✓ Moved ${#MOVED[@]} issue(s) from open/ to done/:"
printf '  - %s\n' "${MOVED[@]}"
echo ""
echo "Stage and commit:"
echo "  git add issues/ && git commit -m 'chore: close merged issues'"
