#!/usr/bin/env bash
# Checks that the committed generated files match their source (decision 0012).
#
# Usage: drift.sh [--root <dir>] [--print-target]
#
# Reads contracts_generate_target from harness/config.yml. Empty: nothing to compare. Otherwise
# runs `make <target>` and compares the files that differ from HEAD or are untracked, before and
# after the run. A file the generator changed means the committed copy does not match its source.
# A stale generated file in the working tree is overwritten and counts. A regenerated file that
# is not committed yet passes, because make check runs before the commit; CI starts from the
# commit and finds it when it was left out.
# The new output stays in the working tree. The generator must write the same bytes for the same
# source; a timestamp in the output is drift on every run.
# --print-target prints the target and exits; CI uses it to skip the setup without a generator.
# Exit 0: no drift or no generator. Exit 1: drift or a failed generator. Exit 2: usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PRINT_TARGET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT=$(cd "$2" && pwd); shift 2 ;;
    --print-target) PRINT_TARGET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

CONFIG="$ROOT/harness/config.yml"
target=""
if [ -f "$CONFIG" ]; then
  target=$(awk '$1 == "contracts_generate_target:" { v = $2; gsub(/"/, "", v); print v; exit }' "$CONFIG")
fi
if [ -n "$target" ] && ! [[ "$target" =~ ^[A-Za-z0-9_][A-Za-z0-9_.:/-]*$ ]]; then
  echo "make drift: contracts_generate_target ist kein make-Target: $target" >&2
  exit 2
fi
if [ "$PRINT_TARGET" = 1 ]; then
  [ -z "$target" ] || printf '%s\n' "$target"
  exit 0
fi
if [ -z "$target" ]; then
  echo "make drift: kein Generator konfiguriert (contracts_generate_target in harness/config.yml), nichts zu vergleichen."
  exit 0
fi
git -C "$ROOT" rev-parse --verify -q HEAD >/dev/null || { echo "make drift: kein Commit in $ROOT" >&2; exit 2; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

state() {
  { git -C "$ROOT" diff --relative --name-only HEAD --; git -C "$ROOT" ls-files --others --exclude-standard; } | sort -u |
    while IFS= read -r f; do
      if [ -f "$ROOT/$f" ]; then
        printf '%s %s\n' "$(git -C "$ROOT" hash-object -- "$f")" "$f"
      else
        printf 'deleted %s\n' "$f"
      fi
    done | sort
}

state > "$TMP/before"
if ! make -C "$ROOT" --no-print-directory "$target"; then
  echo "make drift: make $target ist fehlgeschlagen." >&2
  exit 1
fi
state > "$TMP/after"

comm -3 "$TMP/before" "$TMP/after" | sed 's/^[[:space:]]*//' | cut -d' ' -f2- | sort -u > "$TMP/changed"
[ -s "$TMP/changed" ] || exit 0

{
  echo "make drift: make $target hat diese Dateien geändert:"
  sed 's/^/  /' "$TMP/changed"
  echo "Die committeten generierten Dateien passen nicht zu ihrer Quelle. Die neue Fassung liegt im"
  echo "Arbeitsverzeichnis: prüfen und zusammen mit der Quelle committen. Nie von Hand angleichen."
} >&2
if [ -n "${CI:-}" ]; then
  while IFS= read -r f; do
    if git -C "$ROOT" ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
      git -C "$ROOT" --no-pager diff -- "$f" 2>/dev/null | head -100 >&2 || true
    elif [ -f "$ROOT/$f" ]; then
      echo "--- neu: $f" >&2
      head -100 "$ROOT/$f" >&2 || true
    fi
  done < "$TMP/changed"
fi
exit 1
