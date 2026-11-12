#!/usr/bin/env bash
# Human gates G3 and G2 (harness/policies/human-approval.md). Decides whether a pull request has the
# verification and the review by a person that its risk level needs. auto-merge.yml runs the copy
# from the base branch, so a pull request cannot change the rule it is judged by.
#
# Usage:
#   human-gate.sh --level <low|medium|high> --pr <n> --sha <head sha> --author <login>
#                 [--repo <owner/name>] [--config <file>] [--labels <a,b,...>]
#                 [--reviews-json <file>] [--events-json <file>] [--statuses-json <file>]
#                 [--pushed-at <iso time>] [--permissions <login=permission,...>] [--remove-stale]
#
# Without --labels, the *-json options, --pushed-at and --permissions the data comes from the
# GitHub API. G3: for the levels in verify_required_for the head needs the commit status verified
# = success; pull requests by bots are exempt. An approval counts only from an account with the
# permission write, maintain or admin.
# Exit 0: the gate passes. Exit 1: the gate fails; the output says why. Exit 2: usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CONFIG="$ROOT/harness/config.yml"
LEVEL=""
PR=""
SHA=""
AUTHOR=""
REPO=""
LABELS=""
LABELS_SET=0
REVIEWS_JSON=""
EVENTS_JSON=""
STATUSES_JSON=""
PUSHED_AT=""
PERMISSIONS=""
PERMISSIONS_SET=0
REMOVE_STALE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --level) LEVEL="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --sha) SHA="$2"; shift 2 ;;
    --author) AUTHOR="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --config) CONFIG="$2"; shift 2 ;;
    --labels) LABELS="$2"; LABELS_SET=1; shift 2 ;;
    --reviews-json) REVIEWS_JSON="$2"; shift 2 ;;
    --events-json) EVENTS_JSON="$2"; shift 2 ;;
    --statuses-json) STATUSES_JSON="$2"; shift 2 ;;
    --pushed-at) PUSHED_AT="$2"; shift 2 ;;
    --permissions) PERMISSIONS="$2"; PERMISSIONS_SET=1; shift 2 ;;
    --remove-stale) REMOVE_STALE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$LEVEL" in low|medium|high) ;; *) echo "--level must be low, medium or high" >&2; exit 2 ;; esac
[[ "$PR" =~ ^[0-9]+$ ]] || { echo "--pr must be a number" >&2; exit 2; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "--sha must be a full commit SHA" >&2; exit 2; }
[[ "$AUTHOR" =~ ^[A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?$ ]] || { echo "--author is not a GitHub login" >&2; exit 2; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
short=${SHA:0:7}

pass() { echo "$1"; exit 0; }
fail() { echo "$1"; exit 1; }

cfg() {
  local v
  v=$(awk -v key="$1:" '$1 == key { v=$2; gsub(/"/, "", v); print "=" v; exit }' "$CONFIG" 2>/dev/null || true)
  if [ -n "$v" ]; then printf '%s\n' "${v#=}"; else printf '%s\n' "$2"; fi
}

gh_repo() { if [ -n "$REPO" ]; then echo "--repo"; echo "$REPO"; fi; }

remove_stale() {
  [ "$REMOVE_STALE" = 1 ] || return 0
  # shellcheck disable=SC2046
  if gh pr edit "$PR" $(gh_repo) --remove-label "$1" >/dev/null 2>&1; then echo "Label '$1' removed."; fi
}

[ "$LEVEL" = low ] && pass "Risk low: no review by a person required (G2 does not apply)."

second=$(cfg second_reviewer_for "")
case "$second" in
  ""|high|medium) ;;
  *) fail "harness/config.yml: second_reviewer_for has the unknown value '$second'. Allowed: \"\", high, medium." ;;
esac
verify_for=$(cfg verify_required_for high)
case "$verify_for" in
  ""|high|medium) ;;
  *) fail "harness/config.yml: verify_required_for has the unknown value '$verify_for'. Allowed: \"\", high, medium." ;;
esac
label=$(cfg human_approval_label human-approved)
if [ -n "$label" ]; then
  if ! [[ "$label" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || [ "$label" = needs-human ]; then
    fail "harness/config.yml: human_approval_label '$label' is not allowed. Use a plain name such as human-approved."
  fi
fi

need_verify=0
case "$verify_for" in
  high) [ "$LEVEL" = high ] && need_verify=1 ;;
  medium) need_verify=1 ;;
esac
if [ "$need_verify" = 1 ] && [[ "$AUTHOR" == *"[bot]" ]]; then
  echo "Author $AUTHOR is a bot: G3 does not apply, CI is its check."
  need_verify=0
fi
if [ "$need_verify" = 1 ]; then
  if [ -n "$STATUSES_JSON" ]; then
    cat "$STATUSES_JSON" > "$TMP/status.json"
  else
    gh api "repos/$REPO/commits/$SHA/status?per_page=100" > "$TMP/status.json"
  fi
  verified=$(jq -r '[.statuses[]? | select(.context == "verified")] | first | .state // ""' "$TMP/status.json")
  case "$verified" in
    success) echo "Risk $LEVEL: verified on commit $short (G3)." ;;
    "") fail "Risk $LEVEL: commit $short has no status verified (G3). The session runs verify after its last push, or a person runs /verify $PR. Set the label after that push." ;;
    *) fail "Risk $LEVEL: verify reports $verified on commit $short (G3): a criterion is not met or a check failed. The criteria table in the PR body names it." ;;
  esac
fi

if [ -n "$REVIEWS_JSON" ]; then
  cat "$REVIEWS_JSON" > "$TMP/reviews.json"
else
  gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" > "$TMP/reviews.json"
fi
candidates=$(jq -r --arg sha "$SHA" --arg author "$AUTHOR" '
  [.[] | select(.commit_id == $sha and .user.login != $author and .user.type == "User")
       | select(.author_association == "OWNER" or .author_association == "MEMBER" or .author_association == "COLLABORATOR")
       | select(.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "DISMISSED")]
  | group_by(.user.login) | map(last | select(.state == "APPROVED") | .user.login) | .[]
' "$TMP/reviews.json")
permission_of() {
  if [ "$PERMISSIONS_SET" = 1 ]; then
    printf '%s\n' "$PERMISSIONS" | tr ',' '\n' | awk -F= -v l="$1" '$1 == l { print $2; exit }'
  else
    gh api "repos/$REPO/collaborators/$1/permission" --jq '.permission' 2>"$TMP/permission.err" \
      || echo "Could not read the permission of $1: $(head -1 "$TMP/permission.err")" >&2
  fi
}
approvers=""
for login in $candidates; do
  case "$(permission_of "$login")" in
    admin|maintain|write) approvers="${approvers:+$approvers, }$login" ;;
    *) echo "Approval by $login on commit $short does not count: no write permission found." ;;
  esac
done
[ -n "$approvers" ] && pass "Risk $LEVEL: approved on commit $short by $approvers (G2)."

need_second=0
case "$second" in
  high) [ "$LEVEL" = high ] && need_second=1 ;;
  medium) need_second=1 ;;
esac
[ "$need_second" = 1 ] && fail "Risk $LEVEL: harness/config.yml requires an approving review on commit $short by a person other than $AUTHOR (second_reviewer_for: $second)."
[ -n "$label" ] || fail "Risk $LEVEL: the label is switched off (human_approval_label). An approving review on commit $short by a person other than $AUTHOR is required."

if [ "$LABELS_SET" = 0 ]; then
  # shellcheck disable=SC2046
  LABELS=$(gh pr view "$PR" $(gh_repo) --json labels --jq '[.labels[].name] | join(",")')
fi
case ",$LABELS," in
  *",$label,"*) ;;
  *) fail "Risk $LEVEL: after your review set the label '$label', or get an approving review by another person (G2)." ;;
esac

if [ -n "$EVENTS_JSON" ]; then
  cat "$EVENTS_JSON" > "$TMP/events.json"
else
  gh api --paginate "repos/$REPO/issues/$PR/events?per_page=100" | jq -s 'add // []' > "$TMP/events.json"
fi
last=$(jq -r --arg l "$label" '
  [.[] | select(.event == "labeled" and .label.name == $l)] | last
  | if . == null then "" else "\(.created_at) \(.actor.type)" end
' "$TMP/events.json")
[ -n "$last" ] || fail "Risk $LEVEL: label '$label' is set, but no event shows who set it. Set the label again."
labeled_at=${last%% *}
actor_type=${last##* }

if [ "$actor_type" != User ]; then
  remove_stale "$label"
  fail "Risk $LEVEL: the label '$label' was set by an account of type $actor_type, not by a person."
fi

if [ -z "$PUSHED_AT" ]; then
  PUSHED_AT=$(gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=100" --jq '[.workflow_runs[].created_at] | min // ""')
fi
[ -n "$PUSHED_AT" ] || fail "Risk $LEVEL: no workflow run found for commit $short, so the time of its push is unknown."

if [[ "$labeled_at" > "$PUSHED_AT" ]]; then
  pass "Risk $LEVEL: label '$label' set by a person at $labeled_at, after the push of $short at $PUSHED_AT (G2)."
fi
remove_stale "$label"
fail "Risk $LEVEL: the label '$label' dates from $labeled_at, before the push of $short at $PUSHED_AT. The push time is the start of the first workflow run of the commit, a few seconds after the push, so a label set within those seconds counts as before it. Review the new commits, then set the label again."
