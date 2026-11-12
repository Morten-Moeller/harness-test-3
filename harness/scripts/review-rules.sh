#!/usr/bin/env bash
# Deterministic review rules for a pull request (harness/review.md). The script checks what needs
# no judgement, so the AI reviews skip it and the result does not depend on a model.
#
# Usage:
#   review-rules.sh --pr <number> [--root <dir>] [--format markdown|tsv|json]
#   review-rules.sh --files-from <file> --diff-from <file> [--body-from <file>] [--title <text>]
#                   [--author <login>] [--base-ref <ref>] [--head-ref <ref>] [--level <level>]
#                   [--matrix <file>] [--config <file>] [--format markdown|tsv|json]
#
# --root names the checkout to read; CI runs the copy of this script from the base branch and
# passes the matrix and the config of the base branch, so a PR cannot change its own rules.
# Exit 0: no blocking finding. Exit 1: blocking findings. Exit 2: usage error.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PR=""
MATRIX=""
CONFIG=""
FILES_FROM=""
DIFF_FROM=""
BODY_FROM=""
TITLE=""
AUTHOR=""
BASE_REF=""
HEAD_REF=""
LEVEL=""
FORMAT="markdown"
MAX_PER_RULE=20

while [ $# -gt 0 ]; do
  case "$1" in
    --pr) PR="$2"; shift 2 ;;
    --root) ROOT=$(cd "$2" && pwd); shift 2 ;;
    --files-from) FILES_FROM="$2"; shift 2 ;;
    --diff-from) DIFF_FROM="$2"; shift 2 ;;
    --body-from) BODY_FROM="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --author) AUTHOR="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2"; shift 2 ;;
    --head-ref) HEAD_REF="$2"; shift 2 ;;
    --level) LEVEL="$2"; shift 2 ;;
    --matrix) MATRIX="$2"; shift 2 ;;
    --config) CONFIG="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
case "$FORMAT" in markdown|tsv|json) ;; *) echo "unknown format: $FORMAT" >&2; exit 2 ;; esac
CONFIG=${CONFIG:-$ROOT/harness/config.yml}
MATRIX=${MATRIX:-$ROOT/harness/risk-matrix.yml}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cfg_list() {
  [ -f "$CONFIG" ] || return 0
  awk -v key="$1:" '
    $1 == key { f=1; next }
    f && /^[ \t]*-[ \t]*/ { s=$0; sub(/^[ \t]*-[ \t]*/, "", s); gsub(/"/, "", s); print s; next }
    f { f=0 }
  ' "$CONFIG"
}

if [ -n "$PR" ]; then
  command -v gh >/dev/null 2>&1 || { echo "gh is required for --pr" >&2; exit 2; }
  gh pr view "$PR" --json title,body,author,baseRefName,headRefOid,files > "$TMP/pr.json"
  TITLE=$(jq -r '.title' "$TMP/pr.json")
  AUTHOR=$(jq -r '.author.login' "$TMP/pr.json")
  jq -r '.body // ""' "$TMP/pr.json" > "$TMP/body.raw"
  jq -r '.files[].path' "$TMP/pr.json" > "$TMP/files"
  gh pr diff "$PR" > "$TMP/diff"
  base=$(jq -r '.baseRefName' "$TMP/pr.json")
  HEAD_REF=$(jq -r '.headRefOid' "$TMP/pr.json")
  git -C "$ROOT" rev-parse -q --verify "origin/$base" >/dev/null || git -C "$ROOT" fetch -q origin "$base"
  BASE_REF="origin/$base"
  git -C "$ROOT" cat-file -e "$HEAD_REF^{commit}" 2>/dev/null || git -C "$ROOT" fetch -q origin "pull/$PR/head"
else
  { [ -n "$FILES_FROM" ] && [ -n "$DIFF_FROM" ]; } || { usage >&2; exit 2; }
  grep -v '^[[:space:]]*$' "$FILES_FROM" > "$TMP/files" || true
  cat "$DIFF_FROM" > "$TMP/diff"
  if [ -n "$BODY_FROM" ]; then cat "$BODY_FROM" > "$TMP/body.raw"; else : > "$TMP/body.raw"; fi
fi
tr -d '\r' < "$TMP/body.raw" > "$TMP/body"

head_show() {
  if [ -n "$HEAD_REF" ]; then git -C "$ROOT" show "$HEAD_REF:$1" 2>/dev/null; else cat "$ROOT/$1" 2>/dev/null; fi
}
head_ls() {
  if [ -n "$HEAD_REF" ]; then
    git -C "$ROOT" ls-tree -r --name-only "$HEAD_REF" -- "$1" 2>/dev/null
  else
    (cd "$ROOT" && find "$1" -type f 2>/dev/null)
  fi
}
base_show() {
  [ -n "$BASE_REF" ] || return 1
  git -C "$ROOT" show "$BASE_REF:$1" 2>/dev/null
}

if [ -z "$LEVEL" ]; then
  LEVEL=$("$ROOT/harness/scripts/risk-level.sh" --files-from "$TMP/files" --diff-from "$TMP/diff" --matrix "$MATRIX" --config "$CONFIG" --format level)
fi

cfg_list review_rules_disabled > "$TMP/disabled"
enabled() { ! grep -qx "$1" "$TMP/disabled"; }

dep=0
case "$AUTHOR" in dependabot*|app/dependabot) dep=1 ;; esac
harness_repo=0
[ -d "$ROOT/harness/templates" ] && harness_repo=1

# Changed lines: sign, file, new line number (0 for removed lines), text.
awk '
  /^diff --git / { file=""; oldfile=""; inh=0; next }
  inh == 0 && /^--- / { g=$0; sub(/^--- /, "", g); sub(/^a\//, "", g); oldfile=g; next }
  inh == 0 && /^\+\+\+ / { f=$0; sub(/^\+\+\+ /, "", f); sub(/^b\//, "", f); if (f == "/dev/null") f=""; file=f; next }
  /^@@ / { inh=1; if (match($0, /\+[0-9]+/)) ln = substr($0, RSTART + 1, RLENGTH - 1) + 0; next }
  inh == 1 && /^\\/ { next }
  inh == 1 && /^\+/ { print "+\t" file "\t" ln "\t" substr($0, 2); ln++; next }
  inh == 1 && /^-/ { print "-\t" (file != "" ? file : oldfile) "\t0\t" substr($0, 2); next }
  inh == 1 && /^ / { ln++; next }
' "$TMP/diff" > "$TMP/lines"

awk -F'\t' '$1 == "+" { print $2 "\t" $3 "\t" $4 }' "$TMP/lines" \
  | grep -vE '^(docs/[^	]*|[^	]*\.md|harness/risk-matrix\.yml|harness/scripts/review-rules\.sh|harness/scripts/tests/[^	]*)	' > "$TMP/added.code" || true

: > "$TMP/findings"
add() { printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$TMP/findings"; }

# Spec of the pull request.
spec_id=""
re='\(([0-9]{4})\)'
if [[ "$TITLE" =~ $re ]]; then spec_id=${BASH_REMATCH[1]}; fi
if [ -z "$spec_id" ]; then
  spec_id=$(grep -oE 'docs/specs/[0-9]{4}-' "$TMP/body" | grep -vE '/0000-' | head -1 | grep -oE '[0-9]{4}' || true)
fi
spec_file=""
if [ -n "$spec_id" ]; then
  spec_file=$(head_ls docs/specs | grep -E "^docs/specs/${spec_id}-.*\\.md$" | head -1 || true)
fi
decision=""
if [ "$harness_repo" = 1 ]; then
  decision=$({ grep -E '^harness/decisions/[0-9]{4}-.*\.md$' "$TMP/files"; grep -oE 'harness/decisions/[0-9]{4}-[A-Za-z0-9._-]+\.md' "$TMP/body"; } | head -1 || true)
fi

# spec: every change starts from an approved spec (AGENTS.md, harness/workflow.md G0).
if enabled spec && [ "$dep" = 0 ]; then
  if [ -n "$spec_file" ]; then
    status=$(head_show "$spec_file" | awk '/^---[ \t]*$/ { n++; next } n == 1 && /^status:/ { sub(/^status:[ \t]*/, ""); gsub(/"/, ""); print; exit }' || true)
    case "$status" in
      ""|draft) add spec "$spec_file" process ja "Spec hat Status '${status:-leer}'. G0 fehlt: die Person gibt die Spec frei." ;;
    esac
  elif [ -n "$decision" ]; then
    :
  elif [ -n "$spec_id" ]; then
    add spec "–" process ja "Spec $spec_id ist genannt, aber docs/specs/$spec_id-*.md fehlt."
  else
    b=ja
    [ "$LEVEL" = low ] && b=nein
    add spec "–" process "$b" "Keine Spec: weder (NNNN) im Titel noch docs/specs/NNNN-*.md im PR-Text."
  fi
fi

# adr: high risk needs an ADR (harness/policies/adr.md, condition 1).
if enabled adr && [ "$dep" = 0 ] && [ "$LEVEL" = high ]; then
  has=0
  if cat "$TMP/body" "$TMP/files" | grep -oE 'docs/adr/[0-9]{4}-' | grep -qvE '/0000-'; then has=1; fi
  if [ "$harness_repo" = 1 ] && cat "$TMP/body" "$TMP/files" | grep -qE 'harness/decisions/[0-9]{4}-'; then has=1; fi
  if [ -n "$spec_file" ] && head_show "$spec_file" | grep -qE '^adrs:[[:space:]]*\[[^]]*[0-9]'; then has=1; fi
  [ "$has" = 1 ] || add adr "–" process ja "Risiko high, aber kein ADR verlinkt (harness/policies/adr.md, Bedingung 1)."
fi

# entscheidung: an accepted ADR or decision changes only in its status line.
if enabled entscheidung; then
  grep -E '^(docs/adr|harness/decisions)/[0-9]{4}-.*\.md$' "$TMP/files" | while IFS= read -r f; do
    content=$(base_show "$f" || true)
    [ -n "$content" ] || continue
    printf '%s\n' "$content" | grep -qiE '^Status:[[:space:]]*accepted' || continue
    n=$(awk -F'\t' -v f="$f" '$2 == f && ($1 == "+" || $1 == "-") && $4 !~ /^Status:/ { c++ } END { print c + 0 }' "$TMP/lines")
    if [ "$n" -gt 0 ]; then
      add entscheidung "$f" process ja "Akzeptierte Entscheidung geändert ($n Zeilen außer der Statuszeile). Eine neue Entscheidung ersetzt sie."
    fi
  done || true
fi

# gate: no check is switched off without a stated reason (harness/quality-gates.md).
gate_reason=$(grep -E '^Gate-Änderung:' "$TMP/body" | head -1 | sed 's/^Gate-Änderung:[[:space:]]*//' || true)
case "$gate_reason" in "<"*) gate_reason="" ;; esac
if enabled gate; then
  GATE_RE=$(awk -v q="'" '
    /^[A-Za-z_]+:/ { cur=$1; sub(/:$/, "", cur); next }
    cur == "gate_markers" && /^[ \t]*-[ \t]*/ {
      s=$0; sub(/^[ \t]*-[ \t]*/, "", s); sub(/[ \t]+$/, "", s)
      f = substr(s, 1, 1); l = substr(s, length(s), 1)
      if (length(s) > 1 && f == l && (f == "\"" || f == q)) s = substr(s, 2, length(s) - 2)
      if (s != "") printf "%s(%s)", (n++ ? "|" : ""), s
    }
  ' "$MATRIX" 2>/dev/null || true)
  if [ -z "$GATE_RE" ]; then
    add gate "harness/risk-matrix.yml" process ja "Die Liste gate_markers fehlt oder ist leer; abgeschaltete Prüfungen werden nicht erkannt."
    GATE_RE='a^'
  fi
  b=ja
  [ -n "$gate_reason" ] && b=nein
  GATE_RE="$GATE_RE" awk -F'\t' '$3 ~ ENVIRON["GATE_RE"] { t=$3; sub(/^[ \t]+/, "", t); print $1 ":" $2 "\t" substr(t, 1, 80) }' "$TMP/added.code" \
    | while IFS=$'\t' read -r loc text; do
        if [ "$b" = ja ]; then
          add gate "$loc" process ja "Prüfung abgeschaltet ohne Zeile 'Gate-Änderung: <Grund>' im PR: $text"
        else
          add gate "$loc" process nein "Prüfung abgeschaltet, Grund im PR: $gate_reason. Code: $text"
        fi
      done
  grep -E '(^|/)(\.gitleaks\.toml|\.gitleaksignore|osv-scanner\.toml|\.semgrepignore|\.eslintignore|\.markdownlint[^/]*|\.golangci\.[a-z]+|eslint\.config\.[a-z]+|\.eslintrc[^/]*|Makefile|[^/]+\.mk|lint-baseline\.txt)$|(^|/)(\.semgrep|\.githooks)/' "$TMP/files" \
    | while IFS= read -r f; do
        add gate "$f" process nein "Gate-Datei geändert. Kein automatischer Merge (harness/policies/auto-merge.md)."
      done || true
fi

# kommentar: no comments in code under the source paths (AGENTS.md).
if enabled kommentar; then
  cfg_list source_paths > "$TMP/source_paths"
  awk -F'\t' '
    NR == FNR { sp[++n] = $0; next }
    function ext(f,   k, a) { k = split(f, a, "."); return (k > 1) ? tolower(a[k]) : "" }
    {
      inside = 0
      for (i = 1; i <= n; i++) if ($1 == sp[i] || index($1, sp[i] "/") == 1) inside = 1
      if (!inside) next
      e = ext($1); t = $3; sub(/^[ \t]+/, "", t); c = 0
      if (e ~ /^(ts|tsx|js|jsx|mjs|cjs|go|cs|java|kt|kts|swift|c|h|cc|cpp|hpp|rs|php|scala|dart)$/) {
        if (t ~ /^\/\// && t !~ /^\/\/(go:|nolint|[ ]*(eslint|@ts-|prettier-ignore))/ && t !~ /^\/\/\/[ ]*<reference/) c = 1
        else if (t ~ /^\/\*/) c = 1
      } else if (e ~ /^(py|rb|sh|bash|zsh|pl|r|ex|exs)$/) {
        if (t ~ /^#/ && t !~ /^#!/ && t !~ /^#[ ]*(noqa|type:|pragma|region|endregion|shellcheck|frozen_string_literal)/) c = 1
      } else if (e ~ /^(css|scss|sass|less)$/) {
        if (t ~ /^\/\*/ || t ~ /^\/\//) c = 1
      } else if (e ~ /^(html|vue|svelte|xml|xaml|cshtml|razor)$/) {
        if (t ~ /^<!--/) c = 1
      } else if (e == "sql") {
        if (t ~ /^--/) c = 1
      }
      if (c) print $1 ":" $2 "\t" substr(t, 1, 80)
    }
  ' "$TMP/source_paths" "$TMP/added.code" | while IFS=$'\t' read -r loc text; do
    add kommentar "$loc" process nein "Kommentar im Code (AGENTS.md: keine Kommentare): $text"
  done || true
fi

# generiert: generated files are regenerated, not edited (contracts/README.md).
if enabled generiert; then
  grep -vE '\.md$|^harness/scripts/review-rules\.sh$' "$TMP/files" | while IFS= read -r f; do
    top=$(head_show "$f" | head -10 || true)
    [ -n "$top" ] || continue
    if printf '%s\n' "$top" | grep -qE 'DO NOT EDIT' || printf '%s\n' "$top" | grep -qiE '@generated|code generated|auto-?generated|this file (is|was) generated'; then
      add generiert "$f" process nein "Generierte Datei geändert. Mit dem Generator erzeugen, nicht von Hand (contracts/README.md)."
    fi
  done || true
fi

# kriterium: every acceptance criterion of the spec has evidence in the PR.
if enabled kriterium && [ -n "$spec_file" ]; then
  head_show "$spec_file" | awk '
    /^## / { sec = $0; next }
    sec ~ /Akzeptanzkriterien/ && /^\|[ \t]*A[0-9]+[ \t]*\|/ { if (match($0, /A[0-9]+/)) print substr($0, RSTART, RLENGTH) }
  ' | sort -u > "$TMP/spec.criteria" || true
  awk -F'|' '
    /^\|[ \t]*A[0-9]+/ {
      id = $2; gsub(/[ \t]/, "", id)
      if (match(id, /^A[0-9]+/)) id = substr(id, RSTART, RLENGTH); else next
      ev = $3; gsub(/^[ \t]+|[ \t]+$/, "", ev)
      if (ev != "" && ev !~ /^</) print id
    }
  ' "$TMP/body" | sort -u > "$TMP/body.criteria"
  comm -23 "$TMP/spec.criteria" "$TMP/body.criteria" | while IFS= read -r id; do
    add kriterium "$spec_file" process ja "Kriterium $id ohne Nachweis in der Tabelle Akzeptanzkriterien des PR."
  done || true
fi

# contract: a contract change is named in the spec (contracts/README.md).
if enabled contract && [ -n "$spec_file" ] && grep -E '^contracts/' "$TMP/files" | grep -qvE '^contracts/README\.md$'; then
  section=$(head_show "$spec_file" | awk '
    /^## / { s = ($0 ~ /^## Contracts/); next }
    s {
      line = $0
      while (1) {
        if (inc) { e = index(line, "-->"); if (e == 0) { line = ""; break } line = substr(line, e + 3); inc = 0 }
        b = index(line, "<!--"); if (b == 0) break
        rest = substr(line, b + 4); e = index(rest, "-->")
        if (e == 0) { line = substr(line, 1, b - 1); inc = 1; break }
        line = substr(line, 1, b - 1) substr(rest, e + 3)
      }
      print line
    }
  ' | tr -d '[:space:]' || true)
  case "$section" in
    ""|keine*|Keine*) add contract "$spec_file" process ja "contracts/ geändert, aber die Spec nennt unter ## Contracts nichts." ;;
  esac
fi

# doku: a document whose sources changed is named for a check (decision 0014). The sources are
# globs in its front matter: `sources: [src/orders/**, contracts/api/orders.yaml]` or a list.
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
if enabled doku; then
  if [ -n "$HEAD_REF" ]; then
    git -C "$ROOT" grep -l -E '^sources:' "$HEAD_REF" -- '*.md' 2>/dev/null | sed "s|^$HEAD_REF:||" > "$TMP/doc.files" || true
  else
    git -C "$ROOT" grep -l -E '^sources:' -- '*.md' 2>/dev/null > "$TMP/doc.files" || true
  fi
  while IFS= read -r doc; do
    [ -n "$doc" ] || continue
    grep -qxF "$doc" "$TMP/files" && continue
    head_show "$doc" | awk '
      function emit(g) { gsub(/^[ \t]+|[ \t]+$/, "", g); gsub(/^["\047]|["\047]$/, "", g); if (g != "") print g }
      NR == 1 { if ($0 != "---") exit; next }
      $0 == "---" { exit }
      /^sources:/ {
        v = $0; sub(/^sources:[ \t]*/, "", v)
        if (v ~ /^\[/) { gsub(/^\[|\][ \t]*$/, "", v); k = split(v, a, ","); for (i = 1; i <= k; i++) emit(a[i]); f = 0 }
        else if (v != "") { emit(v); f = 0 }
        else f = 1
        next
      }
      f && /^[ \t]*-/ { g = $0; sub(/^[ \t]*-/, "", g); emit(g); next }
      { f = 0 }
    ' > "$TMP/doc.globs" || true
    [ -s "$TMP/doc.globs" ] || continue
    hit=""
    while IFS= read -r g; do
      re=$(glob_to_regex "$g")
      while IFS= read -r f; do
        if [[ "$f" =~ $re ]]; then hit="$f"; break; fi
      done < "$TMP/files"
      [ -n "$hit" ] && break
    done < "$TMP/doc.globs"
    if [ -n "$hit" ]; then
      add doku "$doc" docs nein "Quelle geändert ($hit), die Doku nicht. Prüfen, ob sie noch stimmt."
    fi
  done < "$TMP/doc.files"
fi

# Output: at most MAX_PER_RULE rows per rule, the rest summarised.
awk -F'\t' -v max="$MAX_PER_RULE" '
  { c[$1]++; if (c[$1] <= max) print; else { extra[$1]++; cat[$1] = $3; if ($4 == "ja") blk[$1] = "ja" } }
  END { for (r in extra) printf "%s\t–\t%s\t%s\t%d weitere Stellen\n", r, cat[r], (blk[r] == "ja" ? "ja" : "nein"), extra[r] }
' "$TMP/findings" > "$TMP/out"

total=$(wc -l < "$TMP/out" | tr -d ' ')
blocking=$(awk -F'\t' '$4 == "ja"' "$TMP/out" | wc -l | tr -d ' ')
needs_human=false
grep -q '^gate	' "$TMP/out" && needs_human=true

case "$FORMAT" in
  tsv) cat "$TMP/out" ;;
  markdown)
    if [ "$total" -eq 0 ]; then
      echo "Regelprüfung: keine Befunde (Risiko $LEVEL)."
    else
      echo "Regelprüfung: $blocking blockierend, $((total - blocking)) nicht blockierend (Risiko $LEVEL)."
      echo
      echo "| Regel | Ort | Befund | Blockiert |"
      echo "|---|---|---|---|"
      awk -F'\t' '{ m = $5; gsub(/\|/, "\\|", m); l = $2; gsub(/\|/, "\\|", l); printf "| %s | `%s` | %s | %s |\n", $1, l, m, $4 }' "$TMP/out"
    fi
    ;;
  json)
    jq -Rn --arg level "$LEVEL" --argjson needs_human "$needs_human" '
      [inputs | split("\t") | {rule: .[0], location: .[1], category: .[2], blocking: (.[3] == "ja"), message: .[4]}]
      | {level: $level, blocking: (map(select(.blocking)) | length), needs_human: $needs_human, findings: .}
    ' < "$TMP/out"
    ;;
esac

[ "$blocking" -eq 0 ]
