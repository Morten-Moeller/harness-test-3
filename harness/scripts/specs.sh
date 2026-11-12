#!/usr/bin/env bash
# Prints the overview of the specs from their front matter (decision 0019).
#
# Usage:
#   specs.sh [--open] [--dir <specs directory>]
#
# One markdown table row per docs/specs/NNNN-*.md except 0000: id, title, risk, status, pr,
# updated (created when updated is missing) and note. --open leaves out the specs with status
# done. Prints nothing when there is no spec. Exit 0, 2 on a usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

DIR=""
OPEN=0
need() { [ "$#" -ge 2 ] || { echo "$1 needs a value" >&2; exit 2; }; }
while [ $# -gt 0 ]; do
  case "$1" in
    --open) OPEN=1; shift ;;
    --dir) need "$@"; DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
[ -n "$DIR" ] || DIR="$(cd "$(dirname "$0")/../.." && pwd)/docs/specs"
[ -d "$DIR" ] || exit 0

rows=""
for f in "$DIR"/[0-9][0-9][0-9][0-9]-*.md; do
  [ -f "$f" ] || continue
  name=${f##*/}
  case "$name" in 0000-*) continue ;; esac
  row=$(awk -v file="$name" -v open="$OPEN" '
    function val(s) {
      sub(/^[^:]*:[ \t]*/, "", s); sub(/[ \t]+$/, "", s)
      if (s ~ /^".*"$/ || s ~ /^\047.*\047$/) s = substr(s, 2, length(s) - 2)
      gsub(/\|/, "\\|", s)
      return s
    }
    /^---[ \t]*$/ { n++; if (n == 2) exit; next }
    n == 1 && /^[a-z_]+:/ { k = $0; sub(/:.*/, "", k); f[k] = val($0) }
    END {
      id = f["id"]; if (id == "") id = substr(file, 1, 4)
      st = f["status"]; if (open == 1 && st == "done") exit
      pr = f["pr"]; if (pr != "" && pr !~ /^#/) pr = "#" pr
      day = f["updated"]; if (day == "") day = f["created"]
      printf "| %s | %s | %s | %s | %s | %s | %s |\n", id, \
        (f["title"] == "" ? "–" : f["title"]), (f["risk"] == "" ? "–" : f["risk"]), \
        (st == "" ? "–" : st), (pr == "" ? "–" : pr), (day == "" ? "–" : day), \
        (f["note"] == "" ? "–" : f["note"])
    }
  ' "$f")
  [ -n "$row" ] && rows="${rows}${row}"$'\n'
done

[ -n "$rows" ] || exit 0
echo "| Spec | Titel | Risiko | Status | PR | Stand | Notiz |"
echo "|---|---|---|---|---|---|---|"
printf '%s' "$rows"
