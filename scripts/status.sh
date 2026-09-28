#!/usr/bin/env bash
# Require bash 4+ for associative arrays and other modern features
if [ "${BASH_VERSINFO:-0}" -lt 4 ]; then
  echo "Error: This script requires bash 4 or higher."
  echo "macOS ships with bash 3.2 — install a modern version with:"
  echo "  brew install bash"
  echo "Then re-run this script."
  exit 1
fi
# status.sh — print and refresh the live status of all issues
# Usage: ./scripts/status.sh [--write]
#   --write   update issues/STATUS.md with current state

# NOTE: No set -e — errors handled explicitly

APP_ROOT="$(pwd)"
WORKTREE_BASE="$(pwd)/.worktrees"
STATUS_FILE="$APP_ROOT/issues/STATUS.md"
WRITE_MODE=false

[ "${1}" = "--write" ] && WRITE_MODE=true

get_status() {
  local NNN="$1"
  local SLUG="$2"
  local BRANCH="feature/${SLUG}"

  ls "$APP_ROOT/issues/done/${NNN}"-*.md &>/dev/null && { echo "merged"; return; }

  REMOTE_EXISTS=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REMOTE_EXISTS" -gt 0 ]; then
    echo "pr-open"; return
  fi

  if [ -f "${WORKTREE_BASE}/${SLUG}.audit.log" ]; then
    grep -q "\[APPROVED\]" "${WORKTREE_BASE}/${SLUG}.audit.log" 2>/dev/null && \
      { echo "audit-passed"; return; } || { echo "audit-failed"; return; }
  fi

  [ -d "${WORKTREE_BASE}/${SLUG}" ] && { echo "in-progress"; return; }

  ISSUE_FILE=$(ls "$APP_ROOT/issues/open/${NNN}"-*.md 2>/dev/null | head -1)
  if [ -n "$ISSUE_FILE" ]; then
    BLOCKED_BY=$(grep "^\*\*Blocked by:\*\*" "$ISSUE_FILE" | sed 's/\*\*Blocked by:\*\* *//' | tr -d ' ')
    if [ -n "$BLOCKED_BY" ] && [ "$BLOCKED_BY" != "nothing" ]; then
      ALL_MERGED=true
      for B in $(echo "$BLOCKED_BY" | tr ',' ' ' | tr -d '#'); do
        BNNN=$(printf "%03d" "$B" 2>/dev/null || echo "$B")
        ls "$APP_ROOT/issues/done/${BNNN}"-*.md &>/dev/null || ALL_MERGED=false
      done
      [ "$ALL_MERGED" = "false" ] && { echo "blocked"; return; }
    fi
    TYPE=$(grep "^\*\*Type:\*\*" "$ISSUE_FILE" | sed 's/\*\*Type:\*\* *//')
    echo "$TYPE" | grep -qi "human" && { echo "manual"; return; }
  fi

  echo "open"
}

icon() {
  case "$1" in
    blocked) echo "🔒" ;; open) echo "⏳" ;; in-progress) echo "🔨" ;;
    audit-failed) echo "✗" ;; audit-passed) echo "✓" ;;
    pr-open) echo "👁" ;; merged) echo "✅" ;; manual) echo "👤" ;;
    *) echo "?" ;;
  esac
}

declare -A T B BB SL P S
NNS=()

for F in "$APP_ROOT"/issues/open/[0-9][0-9][0-9]-*.md "$APP_ROOT"/issues/done/[0-9][0-9][0-9]-*.md; do
  [ -f "$F" ] || continue
  FNAME=$(basename "$F" .md)
  NNN="${FNAME%%-*}"
  [[ " ${NNS[*]} " =~ " ${NNN} " ]] && continue
  T[$NNN]=$(grep "^# Issue" "$F" 2>/dev/null | sed 's/# Issue [0-9]*: //' | head -1)
  B[$NNN]="feature/$FNAME"
  BB[$NNN]=$(grep "^\*\*Blocked by:\*\*" "$F" 2>/dev/null | sed 's/\*\*Blocked by:\*\* *//' | head -1)
  SL[$NNN]="$FNAME"
  NNS+=("$NNN")
done

if [ -f "$APP_ROOT/issues/EXECUTION_PLAN.md" ]; then
  CP=""
  while IFS= read -r line; do
    echo "$line" | grep -qE "^## Phase [0-9]+" && CP=$(echo "$line" | grep -oE "[0-9]+" | head -1)
    echo "$line" | grep -qE "^\| [0-9]{3}" && {
      RN=$(echo "$line" | awk -F'|' '{gsub(/ /,"",$2); print $2}')
      [ -n "$RN" ] && [ -n "$CP" ] && P[$RN]="$CP"
    }
  done < "$APP_ROOT/issues/EXECUTION_PLAN.md"
fi

IFS=$'\n' SORTED=($(printf '%s\n' "${NNS[@]}" | sort -u)); unset IFS

for NNN in "${SORTED[@]}"; do S[$NNN]=$(get_status "$NNN" "${SL[$NNN]}"); done

NOW=$(date '+%Y-%m-%d %H:%M')
TOTAL=${#SORTED[@]}
declare -A C
for NNN in "${SORTED[@]}"; do C[${S[$NNN]}]=$((${C[${S[$NNN]}]:-0}+1)); done

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║   Issue Status — $NOW                              ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
printf "%-5s %-35s %-5s %-13s %s\n" "#" "Title" "Phase" "Status" "Branch"
printf "%-5s %-35s %-5s %-13s %s\n" "---" "----" "-----" "------" "------"

for NNN in "${SORTED[@]}"; do
  TT="${T[$NNN]}"
  [ ${#TT} -gt 33 ] && TT="${TT:0:30}..."
  printf "#%-4s %-35s %-5s %s %-11s %s\n" \
    "$NNN" "$TT" "${P[$NNN]:-—}" "$(icon ${S[$NNN]})" "${S[$NNN]}" \
    "$(echo "${B[$NNN]}" | sed 's/feature\///')"
done

echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo " Total: $TOTAL  |  ✅ ${C[merged]:-0}  |  👁 ${C[pr-open]:-0}  |  ✓ ${C[audit-passed]:-0}  |  🔨 ${C[in-progress]:-0}"
echo "         ⏳ ${C[open]:-0}  |  🔒 ${C[blocked]:-0}  |  👤 ${C[manual]:-0}  |  ✗ ${C[audit-failed]:-0}"
echo ""

[ ${C[audit-failed]:-0} -gt 0 ] && echo "⚠  ${C[audit-failed]} audit failure(s) — fix before opening PRs"
[ ${C[audit-passed]:-0} -gt 0 ] && echo "✓  ${C[audit-passed]} branch(es) audited — open PRs on GitHub"
[ ${C[pr-open]:-0} -gt 0 ] && echo "👁  ${C[pr-open]} PR(s) open — review and merge"
[ "${C[merged]:-0}" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ] && echo "🎉  All $TOTAL issues merged!"
echo ""

if [ "$WRITE_MODE" = "true" ]; then
  ROWS=""
  for NNN in "${SORTED[@]}"; do
    ROWS="${ROWS}| ${NNN} | ${T[$NNN]} | ${P[$NNN]:-—} | $(icon ${S[$NNN]}) ${S[$NNN]} | \`${B[$NNN]}\` | ${BB[$NNN]:-nothing} | — | ${NOW} |\n"
  done

  cat > "$STATUS_FILE" << STATUSEOF
# Issue Status

> Auto-generated by \`./scripts/status.sh --write\`.

## Legend
🔒 blocked · ⏳ open · 🔨 in-progress · ✗ audit-failed · ✓ audit-passed · 👁 pr-open · ✅ merged · 👤 manual

## Issues
| # | Title | Phase | Status | Branch | Blocked by | PR | Updated |
|---|---|---|---|---|---|---|---|
$(printf "$ROWS")

## Last refreshed: $NOW
STATUSEOF

  echo "✓ STATUS.md updated"
  git add "$STATUS_FILE" 2>/dev/null && git commit -m "chore: refresh issue status" 2>/dev/null || true
fi
