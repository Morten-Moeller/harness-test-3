#!/usr/bin/env bash
# SessionStart hook. Prints the harness version and the specs that are not done.
# stdout of a SessionStart hook becomes context for the session.
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
version=$(cat "$ROOT/HARNESS_VERSION" 2>/dev/null || echo unknown)
echo "AI harness $version. Read AGENTS.md. Workflow: harness/workflow.md (spec with plan approved in the session, implement up to a reviewed PR, the label of a person merges medium and high risk)."
if [ -x "$ROOT/harness/scripts/specs.sh" ]; then
  rows=$("$ROOT/harness/scripts/specs.sh" --open --dir "$ROOT/docs/specs" 2>/dev/null || true)
  if [ -n "$rows" ]; then
    echo "Specs not done (harness/scripts/specs.sh):"
    echo "$rows"
  fi
fi
exit 0
