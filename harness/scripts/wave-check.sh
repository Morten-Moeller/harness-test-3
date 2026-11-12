#!/usr/bin/env bash
# Checks whether specs can be implemented at the same time (decision 0020). Reads the paths under
# `Dateien:` in the section `## Umsetzung` of each spec and compares every two specs.
#
# Usage:
#   wave-check.sh [--matrix <file>] <spec.md> <spec.md> ...
#
# One line per finding, tab-separated:
#   overlap    <spec> <spec> <path>      both specs change the path, or a file in the directory
#   exclusive  <spec> <spec> <pattern>   both change a path of wave_exclusive (harness/risk-matrix.yml)
#   unchecked  <spec> <path>             not a full path (.../, *, |, <...>), cannot be compared
#   no-paths   <spec>                    no `Dateien:` list
# A path is the first backticked word of a list item, or every backticked word before the first
# "`:" of the item; a leading ./ is dropped, a trailing / marks a directory. Without the key wave_exclusive in the matrix, contracts/** and migration
# directories are exclusive. Exit 0 without findings, 1 with findings, 2 on a usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MATRIX="$ROOT/harness/risk-matrix.yml"
SPECS=()
need() { [ "$#" -ge 2 ] || { echo "$1 needs a value" >&2; exit 2; }; }
while [ $# -gt 0 ]; do
  case "$1" in
    --matrix) need "$@"; MATRIX="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) SPECS+=("$1"); shift ;;
  esac
done
[ "${#SPECS[@]}" -ge 2 ] || { echo "at least two specs are needed" >&2; usage >&2; exit 2; }
for s in "${SPECS[@]}"; do [ -f "$s" ] || { echo "spec not found: $s" >&2; exit 2; }; done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

yaml_list() {
  awk -v key="$2" -v q="'" '
    /^[A-Za-z_]+:/ { cur=$1; sub(/:$/, "", cur); next }
    cur == key && /^[ \t]*-[ \t]*/ {
      s=$0; sub(/^[ \t]*-[ \t]*/, "", s); sub(/[ \t]+$/, "", s)
      f = substr(s, 1, 1); l = substr(s, length(s), 1)
      if (length(s) > 1 && f == l && (f == "\"" || f == q)) s = substr(s, 2, length(s) - 2)
      if (s != "") print s
    }
  ' "$1"
}

glob_to_regex() {
  awk -v g="$1" 'BEGIN {
    n = length(g); out = "^"
    for (i = 1; i <= n; i++) {
      c = substr(g, i, 1)
      if (c == "*") {
        if (substr(g, i + 1, 1) == "*") {
          if (substr(g, i + 2, 1) == "/") { out = out "(.*/)?"; i += 2 } else { out = out ".*"; i += 1 }
        } else { out = out "[^/]*" }
      } else if (c == "?") { out = out "[^/]" }
      else if (index(".()+^$|{}[]\\", c) > 0) { out = out "\\" c }
      else { out = out c }
    }
    print out "$"
  }'
}

if [ -f "$MATRIX" ] && grep -q '^wave_exclusive:' "$MATRIX"; then
  yaml_list "$MATRIX" wave_exclusive > "$TMP/exclusive"
else
  printf '%s\n' 'contracts/**' '**/migration/**' '**/migrations/**' > "$TMP/exclusive"
fi

paths_of() { # <spec> -> one path per line, prefixed "ok<TAB>" or "bad<TAB>"
  awk '
    /^## / { inplan = ($0 ~ /^## Umsetzung/); files = 0; next }
    !inplan { next }
    /^Dateien:/ { files = 1; next }
    files && /^[A-Za-z][^`]*:[ \t]*$/ { files = 0; next }
    files && /^[ \t]*- / {
      item = $0
      cut = index(item, "`:")
      if (cut > 0) item = substr(item, 1, cut)
      else if (match(item, /`[^`]*`/)) item = substr(item, RSTART, RLENGTH)
      while (match(item, /`[^`]*`/)) {
        p = substr(item, RSTART + 1, RLENGTH - 2)
        item = substr(item, RSTART + RLENGTH)
        sub(/^(\.\/)+/, "", p)
        if (p == "") continue
        bad = (p ~ /^\.\.\.|\.\.\.\/|…|\*|\||</ || p ~ /^\//)
        print (bad ? "bad" : "ok") "\t" p
      }
    }
  ' "$1"
}

id_of() {
  local id
  id=$(awk '/^---[ \t]*$/ { n++; if (n == 2) exit; next } n == 1 && /^id:/ { sub(/^id:[ \t]*/, ""); gsub(/["\047]/, ""); print; exit }' "$1")
  [ -n "$id" ] || id=$(basename "$1" | cut -c1-4)
  printf '%s' "$id"
}

: > "$TMP/findings"
ids=()
i=0
for s in "${SPECS[@]}"; do
  id=$(id_of "$s")
  ids+=("$id")
  paths_of "$s" > "$TMP/raw.$i"
  if [ ! -s "$TMP/raw.$i" ]; then printf 'no-paths\t%s\n' "$id" >> "$TMP/findings"; fi
  awk -F'\t' -v id="$id" '$1 == "bad" { printf "unchecked\t%s\t%s\n", id, $2 }' "$TMP/raw.$i" >> "$TMP/findings"
  awk -F'\t' '$1 == "ok" { print $2 }' "$TMP/raw.$i" | sort -u > "$TMP/paths.$i"
  : > "$TMP/excl.$i"
  while IFS= read -r pat; do
    [ -n "$pat" ] || continue
    re=$(glob_to_regex "$pat")
    while IFS= read -r p; do
      if [[ "$p" =~ $re ]]; then printf '%s\n' "$pat" >> "$TMP/excl.$i"; break; fi
    done < "$TMP/paths.$i"
  done < "$TMP/exclusive"
  i=$((i + 1))
done

n=${#SPECS[@]}
a=0
while [ "$a" -lt "$n" ]; do
  b=$((a + 1))
  while [ "$b" -lt "$n" ]; do
    { comm -12 "$TMP/paths.$a" "$TMP/paths.$b"
      awk 'NR == FNR { x[++n] = $0; next }
        { for (i = 1; i <= n; i++) {
            if (x[i] ~ /\/$/ && index($0, x[i]) == 1 && $0 != x[i]) print x[i]
            if ($0 ~ /\/$/ && index(x[i], $0) == 1 && x[i] != $0) print $0
          } }' "$TMP/paths.$a" "$TMP/paths.$b"
    } | sort -u | while IFS= read -r p; do
      printf 'overlap\t%s\t%s\t%s\n' "${ids[$a]}" "${ids[$b]}" "$p"
    done >> "$TMP/findings"
    sort -u "$TMP/excl.$a" > "$TMP/ea"; sort -u "$TMP/excl.$b" > "$TMP/eb"
    comm -12 "$TMP/ea" "$TMP/eb" | while IFS= read -r p; do
      printf 'exclusive\t%s\t%s\t%s\n' "${ids[$a]}" "${ids[$b]}" "$p"
    done >> "$TMP/findings"
    b=$((b + 1))
  done
  a=$((a + 1))
done

if [ -s "$TMP/findings" ]; then
  cat "$TMP/findings"
  exit 1
fi
echo "ok: ${#SPECS[@]} specs, no overlap"
