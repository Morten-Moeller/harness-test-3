#!/usr/bin/env bash
# Computes the risk level of a change: changed files x harness/risk-matrix.yml, then escalators.
# Policy: harness/policies/risk.md.
#
# Usage:
#   risk-level.sh [--base <ref>] [--include-working-tree]
#                 [--files-from <file|->] [--diff-from <file>] [--lines <n>]
#                 [--dependabot <update-type>] [--matrix <file>] [--config <file>]
#                 [--format text|markdown|json|level]
#
# Without --files-from the changed files come from git (<base>...HEAD). The base defaults to
# origin/<default_branch> from harness/config.yml. Exit 0 when a level was computed.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MATRIX="$ROOT/harness/risk-matrix.yml"
CONFIG="$ROOT/harness/config.yml"
BASE=""
WORKING_TREE=0
FILES_FROM=""
DIFF_FROM=""
LINES=""
DEPENDABOT=""
FORMAT="text"

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --include-working-tree) WORKING_TREE=1; shift ;;
    --files-from) FILES_FROM="$2"; shift 2 ;;
    --diff-from) DIFF_FROM="$2"; shift 2 ;;
    --lines) LINES="$2"; shift 2 ;;
    --dependabot) DEPENDABOT="$2"; shift 2 ;;
    --matrix) MATRIX="$2"; shift 2 ;;
    --config) CONFIG="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$FORMAT" in text|markdown|json|level) ;; *) echo "unknown format: $FORMAT" >&2; exit 2 ;; esac
[ -f "$MATRIX" ] || { echo "matrix not found: $MATRIX" >&2; exit 2; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cfg_value() {
  [ -f "$CONFIG" ] || return 0
  awk -v key="$1:" '$1 == key { v=$2; gsub(/"/, "", v); print v; exit }' "$CONFIG"
}

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

compile_list() {
  yaml_list "$MATRIX" "$1" | while IFS= read -r pat; do
    printf '%s\t%s\n' "$(glob_to_regex "$pat")" "$pat"
  done > "$TMP/$1.re"
}
for lvl in high medium low dependency_manifests keyword_exempt; do compile_list "$lvl"; done
yaml_list "$MATRIX" keywords | tr '[:upper:]' '[:lower:]' > "$TMP/keywords"
GATE_RE=$(yaml_list "$MATRIX" gate_markers | awk 'NF { printf "%s(%s)", (n++ ? "|" : ""), $0 }')

match_list() {
  local f="$1" list="$2" re pat
  while IFS=$'\t' read -r re pat; do
    [ -z "$re" ] && continue
    if [[ "$f" =~ $re ]]; then printf '%s\n' "$pat"; return 0; fi
  done < "$TMP/$list.re"
  return 1
}

rank() { case "$1" in low) echo 0 ;; medium) echo 1 ;; high) echo 2 ;; esac; }
name_of() { case "$1" in 0) echo low ;; 1) echo medium ;; *) echo high ;; esac; }
max_level() { if [ "$(rank "$1")" -ge "$(rank "$2")" ]; then echo "$1"; else echo "$2"; fi; }
raise() { name_of $(( $(rank "$1") + 1 > 2 ? 2 : $(rank "$1") + 1 )); }

# Changed files and diff.
if [ -n "$FILES_FROM" ]; then
  if [ "$FILES_FROM" = "-" ]; then cat > "$TMP/files.raw"; else cat "$FILES_FROM" > "$TMP/files.raw"; fi
  : > "$TMP/diff"
  [ -n "$DIFF_FROM" ] && cat "$DIFF_FROM" > "$TMP/diff"
else
  if [ -z "$BASE" ]; then
    b=$(cfg_value default_branch); b=${b:-main}
    if git -C "$ROOT" rev-parse --verify -q "origin/$b" >/dev/null 2>&1; then BASE="origin/$b"; else BASE="$b"; fi
  fi
  git -C "$ROOT" diff --name-only "$BASE...HEAD" > "$TMP/files.raw"
  git -C "$ROOT" diff "$BASE...HEAD" > "$TMP/diff"
  if [ "$WORKING_TREE" = 1 ]; then
    git -C "$ROOT" diff --name-only HEAD >> "$TMP/files.raw"
    git -C "$ROOT" ls-files --others --exclude-standard >> "$TMP/files.raw"
    git -C "$ROOT" diff HEAD >> "$TMP/diff"
  fi
  [ -n "$DIFF_FROM" ] && cat "$DIFF_FROM" > "$TMP/diff"
fi
grep -v '^[[:space:]]*$' "$TMP/files.raw" | sort -u > "$TMP/files" || true

if [ -z "$LINES" ]; then
  LINES=$(grep -cE '^[+-]' "$TMP/diff" 2>/dev/null || true)
  LINES=$(( ${LINES:-0} - 2 * $(grep -cE '^\+\+\+ ' "$TMP/diff" 2>/dev/null || true) ))
  [ "$LINES" -lt 0 ] && LINES=0
fi
MAX_LOW_LINES=$(cfg_value low_risk_max_lines); MAX_LOW_LINES=${MAX_LOW_LINES:-200}

# Pass 1: level and manifest flag per file.
manifests_only=1
file_count=0
: > "$TMP/classified"
while IFS= read -r f; do
  file_count=$((file_count + 1))
  lvl=medium; pat="(no pattern)"
  for l in high medium low; do
    if p=$(match_list "$f" "$l"); then lvl=$l; pat=$p; break; fi
  done
  manifest=0
  if match_list "$f" dependency_manifests >/dev/null; then manifest=1; else manifests_only=0; fi
  printf '%s\t%s\t%s\t%s\n' "$f" "$lvl" "$pat" "$manifest" >> "$TMP/classified"
done < "$TMP/files"
[ "$file_count" -eq 0 ] && manifests_only=0

# Pass 2: manifests, overall level, docs_only.
dependabot_minor=0
case "$DEPENDABOT" in version-update:semver-patch|version-update:semver-minor) dependabot_minor=1 ;; esac
overall=low
docs_only=1
: > "$TMP/results"
: > "$TMP/lowfiles"
while IFS=$'\t' read -r f lvl pat manifest; do
  if [ "$manifest" = 1 ]; then
    if [ "$manifests_only" = 1 ] && [ "$dependabot_minor" = 1 ]; then
      lvl=low; pat="dependabot $DEPENDABOT"
    else
      lvl=$(max_level "$lvl" medium); pat="$pat, dependency manifest"
    fi
  fi
  overall=$(max_level "$overall" "$lvl")
  case "$f" in docs/*|*.md) ;; *) docs_only=0 ;; esac
  [ "$lvl" != low ] && docs_only=0
  [ "$lvl" = low ] && printf '%s\n' "$f" >> "$TMP/lowfiles"
  printf '%s\t%s\t%s\n' "$lvl" "$f" "$pat" >> "$TMP/results"
done < "$TMP/classified"
[ "$file_count" -eq 0 ] && docs_only=0

# Escalators.
: > "$TMP/escalators"
if [ "$overall" = low ] && [ "$LINES" -gt "$MAX_LOW_LINES" ]; then
  overall=medium
  printf 'size: %s changed lines > %s, low raised to medium\n' "$LINES" "$MAX_LOW_LINES" >> "$TMP/escalators"
fi
if [ -s "$TMP/diff" ] && [ -s "$TMP/keywords" ]; then
  awk '
    /^\+\+\+ / { f=$2; sub(/^b\//, "", f); next }
    /^\+/ && !/^\+\+\+/ { print f "\t" substr($0, 2) }
  ' "$TMP/diff" > "$TMP/added"
  cp "$TMP/lowfiles" "$TMP/kwskip"
  while IFS= read -r f; do
    if match_list "$f" keyword_exempt >/dev/null; then printf '%s\n' "$f" >> "$TMP/kwskip"; fi
  done < "$TMP/files"
  awk -F'\t' -v skipfile="$TMP/kwskip" '
    BEGIN { while ((getline l < skipfile) > 0) skip[l]=1 }
    !($1 in skip) { print }
  ' "$TMP/added" > "$TMP/added.nonlow"
  hits=$(tr '[:upper:]' '[:lower:]' < "$TMP/added.nonlow" | grep -c -F -f "$TMP/keywords" || true)
  if [ "${hits:-0}" -gt 0 ]; then
    words=$(tr '[:upper:]' '[:lower:]' < "$TMP/added.nonlow" | grep -o -F -f "$TMP/keywords" | sort -u | tr '\n' ',' | sed 's/,$//; s/,/, /g')
    before=$overall
    overall=$(raise "$overall")
    printf 'keywords: %s added lines match (%s), %s raised to %s\n' "$hits" "$words" "$before" "$overall" >> "$TMP/escalators"
  fi
fi

if [ "$overall" = low ] && [ -n "$GATE_RE" ] && [ -s "$TMP/diff" ]; then
  awk '
    /^\+\+\+ / { f=$2; sub(/^b\//, "", f); next }
    /^\+/ && !/^\+\+\+/ { print f "\t" substr($0, 2) }
  ' "$TMP/diff" | awk -F'\t' '$1 !~ /\.md$/ && $1 !~ /^docs\//' > "$TMP/added.gate"
  gate_hits=$(GATE_RE="$GATE_RE" awk -F'\t' '{ t = $0; sub(/^[^\t]*\t/, "", t); if (t ~ ENVIRON["GATE_RE"]) c++ } END { print c + 0 }' "$TMP/added.gate")
  if [ "$gate_hits" -gt 0 ]; then
    overall=medium
    printf 'gate markers: %s added lines switch off a check, low raised to medium\n' "$gate_hits" >> "$TMP/escalators"
  fi
fi

# Output.
case "$FORMAT" in
  level) echo "$overall" ;;
  text)
    echo "risk: $overall"
    echo "files: $file_count, changed lines: $LINES"
    while IFS=$'\t' read -r lvl f pat; do printf '  %-7s %s  (%s)\n' "$lvl" "$f" "$pat"; done < "$TMP/results"
    if [ -s "$TMP/escalators" ]; then echo "escalators:"; sed 's/^/  /' "$TMP/escalators"; fi
    [ "$docs_only" = 1 ] && echo "docs only: yes"
    [ "$manifests_only" = 1 ] && echo "dependency manifests only: yes"
    true
    ;;
  markdown)
    echo "## Risiko: $overall"
    echo
    echo "| Stufe | Datei | Muster |"
    echo "|---|---|---|"
    # shellcheck disable=SC2016
    while IFS=$'\t' read -r lvl f pat; do printf '| %s | `%s` | `%s` |\n' "$lvl" "$f" "$pat"; done < "$TMP/results"
    echo
    echo "Geänderte Zeilen: $LINES"
    if [ -s "$TMP/escalators" ]; then echo; echo "Eskalatoren:"; echo; sed 's/^/- /' "$TMP/escalators"; fi
    ;;
  json)
    printf '{"level":"%s","lines":%s,"docs_only":%s,"manifests_only":%s,"files":[' "$overall" "$LINES" \
      "$([ "$docs_only" = 1 ] && echo true || echo false)" "$([ "$manifests_only" = 1 ] && echo true || echo false)"
    first=1
    while IFS=$'\t' read -r lvl f pat; do
      [ "$first" = 1 ] || printf ','
      first=0
      printf '{"path":"%s","level":"%s","pattern":"%s"}' "$(printf '%s' "$f" | sed 's/["\\]/\\&/g')" "$lvl" "$(printf '%s' "$pat" | sed 's/["\\]/\\&/g')"
    done < "$TMP/results"
    printf '],"escalators":['
    first=1
    while IFS= read -r e; do
      [ "$first" = 1 ] || printf ','
      first=0
      printf '"%s"' "$(printf '%s' "$e" | sed 's/["\\]/\\&/g')"
    done < "$TMP/escalators"
    printf ']}\n'
    ;;
esac
