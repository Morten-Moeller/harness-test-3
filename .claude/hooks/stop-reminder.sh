#!/usr/bin/env bash
# Stop hook. Reminds about uncommitted changes under the source paths of harness/config.yml.
# Never blocks: it prints a systemMessage and exits 0.
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
input=$(cat 2>/dev/null || true)
case "$input" in *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;; esac
cd "$ROOT" 2>/dev/null || exit 0
[ -f harness/config.yml ] || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
paths=$(awk '
  /^source_paths:/ { f=1; next }
  f && /^[ \t]*-[ \t]*/ { s=$0; sub(/^[ \t]*-[ \t]*/, "", s); gsub(/"/, "", s); print s; next }
  f && !/^[ \t]*-/ { f=0 }
' harness/config.yml)
[ -z "$paths" ] && exit 0
# shellcheck disable=SC2086
changed=$(git status --porcelain -- $paths 2>/dev/null | wc -l | tr -d ' ')
if [ "${changed:-0}" -gt 0 ]; then
  printf '{"systemMessage":"Harness: %s uncommitted files under the source paths. Run make check before a pull request."}\n' "$changed"
fi
exit 0
