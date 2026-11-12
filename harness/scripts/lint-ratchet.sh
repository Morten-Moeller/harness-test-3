#!/usr/bin/env bash
# Ratchet for lint findings (decision 0014). Old code may keep the findings of a rule that the
# baseline records, never more. A project switches on a new rule without fixing all old code first.
#
# Usage: <counts> | lint-ratchet.sh [--baseline <file>] [--update]
#
# stdin: one line per rule, "<rule> <count>". The project's `make lint` builds it from the output of
# its linter, for example `eslint -f json . | jq -r '...'`. Baseline: the same format, default
# lint-baseline.txt in the project root; a rule that is not there has 0 known findings.
# A count above the baseline fails. A count below it passes and asks for --update, which writes the
# lower counts. --update never raises a count; a higher baseline is a gate change in a reviewed PR.
# Without a baseline file --update writes the first one.
# Exit 0: no count above the baseline. Exit 1: a count above it. Exit 2: usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
BASELINE="$ROOT/lint-baseline.txt"
UPDATE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --baseline) BASELINE="$2"; shift 2 ;;
    --update) UPDATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

counts() { awk '$1 !~ /^#/ && NF >= 2 && $2 ~ /^[0-9]+$/ { c[$1] += $2 } END { for (r in c) print r, c[r] }' | sort; }
counts > "$TMP/current"
first=0
if [ -f "$BASELINE" ]; then counts < "$BASELINE" > "$TMP/baseline"; else : > "$TMP/baseline"; first=1; fi

awk '
  FILENAME == base_file { b[$1] = $2; seen[$1] = 1; next }
  { c[$1] = $2; seen[$1] = 1 }
  END {
    for (r in seen) {
      cur = (r in c) ? c[r] : 0; base = (r in b) ? b[r] : 0
      if (cur > base) print "up", r, cur, base
      else if (cur < base) print "down", r, cur, base
    }
  }
' base_file="$TMP/baseline" "$TMP/baseline" "$TMP/current" | sort -k2 > "$TMP/delta"

name=${BASELINE##*/}
up=$(awk '$1 == "up"' "$TMP/delta")
down=$(awk '$1 == "down"' "$TMP/delta")

if [ "$UPDATE" = 1 ]; then
  if [ -n "$up" ] && [ "$first" = 0 ]; then
    printf '%s\n' "$up" | awk -v f="$name" '{ printf "make lint: %s hat %d Befunde, %s erlaubt %d. --update senkt nur; neue Befunde beheben.\n", $2, $3, f, $4 }' >&2
    exit 1
  fi
  { echo "# Known lint findings per rule (harness/scripts/lint-ratchet.sh). Only lower these counts."
    awk '$2 > 0' "$TMP/current"; } > "$BASELINE"
  echo "make lint: $name geschrieben."
  exit 0
fi

if [ -n "$down" ]; then
  printf '%s\n' "$down" | awk -v f="$name" '{ printf "make lint: %s hat %d Befunde, %s erlaubt %d. Gesenkt: harness/scripts/lint-ratchet.sh --update schreibt die neue Zahl.\n", $2, $3, f, $4 }'
fi
if [ -n "$up" ]; then
  printf '%s\n' "$up" | awk -v f="$name" '{ printf "make lint: %s hat %d Befunde, %s erlaubt %d. Die neuen Befunde beheben; die Baseline steigt nicht.\n", $2, $3, f, $4 }' >&2
  exit 1
fi
exit 0
