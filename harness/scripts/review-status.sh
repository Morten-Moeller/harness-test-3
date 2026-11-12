#!/usr/bin/env bash
# The result of /review as the commit status ai-review (harness/review.md, decision 0009), and the
# result of /verify as the commit status verified (decision 0018).
#
# Usage:
#   review-status.sh save    --sha <sha> --file <result.md>
#   review-status.sh load    --sha <sha>
#   review-status.sh publish --sha <sha> [--note <text>] [--repo <owner/name>]
#   review-status.sh set     --sha <sha> --state <success|failure|pending> --description <text> [--repo <owner/name>]
#   review-status.sh verify  --sha <sha> --state <success|failure> --description <text> [--repo <owner/name>]
#   review-status.sh last    --pr <n> [--repo <owner/name>] | --commits-from <file>
#
# save/load keep the result of a run in .git/ai-harness/review/<sha>.md, local and untracked. The
# first line of a result is the header
#   <!-- ai-review state=<success|failure> level=<low|medium|high> reviews=<code,security,...> blocking=<n> notes=<n> -->
# publish sets the status from that header. last prints the newest commit with a saved result,
# from the commits of the pull request or from --commits-from (one SHA per line, oldest first,
# e.g. git rev-list --reverse origin/main..HEAD), or nothing. verify sets the status verified that
# human-gate.sh reads for G3; set is for CI.
# Exit 0: done. Exit 1: no saved result or API error. Exit 2: usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

CONTEXT=ai-review
cmd="${1:-}"
[ $# -gt 0 ] && shift
SHA=""; FILE=""; NOTE=""; REPO=""; STATE=""; DESCRIPTION=""; PR=""; COMMITS_FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA="$2"; shift 2 ;;
    --file) FILE="$2"; shift 2 ;;
    --note) NOTE="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --state) STATE="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --commits-from) COMMITS_FROM="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -n "$REPO" ] && ! [[ "$REPO" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]]; then echo "--repo must be owner/name" >&2; exit 2; fi

need_sha() { [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "--sha must be a full commit SHA" >&2; exit 2; }; }
repo() { if [ -n "$REPO" ]; then echo "$REPO"; else gh repo view --json nameWithOwner -q .nameWithOwner; fi; }
state_dir() {
  local d
  d=$(git rev-parse --git-common-dir)
  case "$d" in /*) ;; *) d="$(pwd)/$d" ;; esac
  echo "$d/ai-harness/review"
}
header_field() { sed -n '1s/.*[[:space:]]'"$1"'=\([^[:space:]]*\).*/\1/p' "$2"; }

set_status() {
  local description="${3:0:140}" context="${4:-$CONTEXT}"
  gh api -X POST "repos/$(repo)/statuses/$1" -f state="$2" -f context="$context" -f description="$description" --silent
  echo "Status $context=$2 on ${1:0:7}: $description"
}

case "$cmd" in
  save)
    need_sha
    [ -f "$FILE" ] || { echo "--file is missing" >&2; exit 2; }
    head -1 "$FILE" | grep -Eq '^<!-- ai-review state=(success|failure) ' || { echo "$FILE has no ai-review header line" >&2; exit 2; }
    mkdir -p "$(state_dir)"
    cp "$FILE" "$(state_dir)/$SHA.md"
    echo "$(state_dir)/$SHA.md"
    ;;
  load)
    need_sha
    [ -f "$(state_dir)/$SHA.md" ] || exit 1
    cat "$(state_dir)/$SHA.md"
    ;;
  publish)
    need_sha
    f="$(state_dir)/$SHA.md"
    [ -f "$f" ] || { echo "No saved result for ${SHA:0:7}. Run the review first." >&2; exit 1; }
    state=$(header_field state "$f")
    reviews=$(header_field reviews "$f" | sed -e 's/code/Code/' -e 's/security/Sicherheit/' -e 's/architecture/Architektur/' -e 's/,/, /g')
    blocking=$(header_field blocking "$f")
    notes=$(header_field notes "$f")
    description="${reviews:-Code}: ${blocking:-0} blockierend, ${notes:-0} Hinweise"
    [ -n "$NOTE" ] && description="$NOTE; $description"
    set_status "$SHA" "$state" "$description"
    ;;
  set)
    need_sha
    case "$STATE" in success|failure|pending) ;; *) echo "--state must be success, failure or pending" >&2; exit 2 ;; esac
    [ -n "$DESCRIPTION" ] || { echo "--description is required" >&2; exit 2; }
    set_status "$SHA" "$STATE" "$DESCRIPTION"
    ;;
  verify)
    need_sha
    case "$STATE" in success|failure) ;; *) echo "--state must be success or failure" >&2; exit 2 ;; esac
    [ -n "$DESCRIPTION" ] || { echo "--description is required" >&2; exit 2; }
    set_status "$SHA" "$STATE" "$DESCRIPTION" verified
    ;;
  last)
    if [ -n "$COMMITS_FROM" ]; then
      commits=$(cat "$COMMITS_FROM")
    else
      [[ "$PR" =~ ^[0-9]+$ ]] || { echo "--pr must be a number, or pass --commits-from" >&2; exit 2; }
      commits=$(gh pr view "$PR" ${REPO:+--repo "$REPO"} --json commits --jq '.commits[].oid')
    fi
    dir=$(state_dir)
    for sha in $(printf '%s\n' "$commits" | awk 'NF { l[++n] = $1 } END { for (i = n; i > 0; i--) print l[i] }'); do
      if [ -f "$dir/$sha.md" ]; then echo "$sha"; exit 0; fi
    done
    ;;
  -h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
