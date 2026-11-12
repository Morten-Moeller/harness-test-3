#!/usr/bin/env bash
# Configures the GitHub repository for the harness: labels, auto-merge, branch ruleset.
#
# Usage (from the project root, gh logged in):
#   setup-repo.sh [--repo owner/name] [--dry-run]
#
# Idempotent: labels are created or updated, the ruleset is created or replaced by name.
# Rulesets and auto-merge on a private repository need GitHub Pro, Team or Enterprise. Without
# them the script creates the labels, says what is missing and exits 1; auto-merge.yml then does
# not enable auto-merge, because the default branch has no required checks.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
REPO=""
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null 2>&1 || { echo "gh is required" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in" >&2; exit 1; }
[ -n "$REPO" ] || REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

run() { if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }
err=$(mktemp)
trap 'rm -f "$err"' EXIT

echo "repository: $REPO"

echo "labels"
run gh label create "risk:low"    --repo "$REPO" --color 0E8A16 --description "Risk level low (harness/policies/risk.md)"    --force
run gh label create "risk:medium" --repo "$REPO" --color FBCA04 --description "Risk level medium (harness/policies/risk.md)" --force
run gh label create "risk:high"   --repo "$REPO" --color B60205 --description "Risk level high (harness/policies/risk.md)"   --force
run gh label create "needs-human" --repo "$REPO" --color 5319E7 --description "Blocks auto-merge; a person decides"         --force
approval_label=$(awk '$1 == "human_approval_label:" { v=$2; gsub(/"/, "", v); print "=" v; exit }' "$ROOT/harness/config.yml")
approval_label=${approval_label:-=human-approved}
approval_label=${approval_label#=}
if [ -n "$approval_label" ]; then
  run gh label create "$approval_label" --repo "$REPO" --color 0052CC --description "G2: a person reviewed this PR (harness/policies/human-approval.md)" --force
fi

missing=""
plan_hint="Rulesets and auto-merge on a private repository need GitHub Pro, Team or Enterprise; or make the repository public (gh repo edit $REPO --visibility public --accept-visibility-change-consequences)."

echo "repository settings"
run gh repo edit "$REPO" --enable-squash-merge --delete-branch-on-merge
if ! run gh repo edit "$REPO" --enable-auto-merge 2>"$err"; then
  echo "auto-merge not enabled: $(head -1 "$err")"
  missing="${missing}auto-merge "
fi

echo "ruleset"
ruleset="$ROOT/harness/github/ruleset.json"
name=$(jq -r .name "$ruleset")
existing=$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name == \"$name\") | .id" 2>/dev/null || true)
if [ -n "$existing" ]; then
  if run gh api -X PUT "repos/$REPO/rulesets/$existing" --input "$ruleset" --silent 2>"$err"; then
    echo "ruleset '$name' updated (id $existing)"
  else
    echo "ruleset not updated: $(head -1 "$err")"
    missing="${missing}ruleset "
  fi
elif run gh api -X POST "repos/$REPO/rulesets" --input "$ruleset" --silent 2>"$err"; then
  echo "ruleset '$name' created"
else
  echo "ruleset not created: $(head -1 "$err")"
  missing="${missing}ruleset "
fi

cat <<MSG

Optional secrets (gh secret set <NAME> --repo $REPO):
  CLAUDE_CODE_OAUTH_TOKEN  from 'claude setup-token' (Claude subscription) so CI runs /review itself;
                           without it /review runs in your session and sets the status ai-review
  ANTHROPIC_API_KEY        alternative to the OAuth token
  AUTOMERGE_TOKEN          PAT so auto-merge works on Dependabot PRs (GITHUB_TOKEN is read-only there)

The required status checks in the ruleset appear in GitHub after the first workflow run.
MSG

if [ -n "$missing" ]; then
  echo
  echo "Not configured: $missing"
  echo "$plan_hint"
  exit 1
fi
