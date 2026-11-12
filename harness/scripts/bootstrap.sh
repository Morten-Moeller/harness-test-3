#!/usr/bin/env bash
# Creates a new project from the harness template.
#
# Usage:
#   bootstrap.sh <target-dir> --name <project> [--owner <github-login>] [--doc-language de]
#                [--source-paths <dir,dir>] [--contracts-target <make-target>]
#                [--github <owner/name>] [--no-git]
#   bootstrap.sh --in-place --name <project> [--owner <github-login>] [--source-paths <dir,dir>]
#                [--contracts-target <make-target>] (inside a "Use this template" checkout)
#
# Copies the template with its dotfiles into an empty folder, applies harness/templates/*
# (Makefile, AGENTS.md, README.md, settings.json, setup action), replaces {{PROJECT_NAME}} and
# {{PROJECT_OWNER}}, removes the files that belong to the harness repository only, writes
# HARNESS_VERSION and initialises git. --source-paths writes source_paths of harness/config.yml,
# --contracts-target its contracts_generate_target (the make target of the gate drift).
# --github adds the remote, commits, pushes the default branch to the existing (empty) GitHub
# repository and runs setup-repo.sh.
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

HARNESS=$(cd "$(dirname "$0")/../.." && pwd)
TARGET=""
NAME=""
OWNER=""
DOC_LANGUAGE=""
IN_PLACE=0
NO_GIT=0
SOURCE_PATHS=""
CONTRACTS_TARGET=""
GITHUB=""

while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --owner) OWNER="$2"; shift 2 ;;
    --doc-language) DOC_LANGUAGE="$2"; shift 2 ;;
    --in-place) IN_PLACE=1; shift ;;
    --source-paths) SOURCE_PATHS="$2"; shift 2 ;;
    --contracts-target) CONTRACTS_TARGET="$2"; shift 2 ;;
    --github) GITHUB="$2"; shift 2 ;;
    --no-git) NO_GIT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) TARGET="$1"; shift ;;
  esac
done

[ -n "$NAME" ] || { echo "--name is required" >&2; usage >&2; exit 2; }
if [ -n "$GITHUB" ]; then
  [[ "$GITHUB" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]] || { echo "--github must be owner/name" >&2; exit 2; }
  { [ "$NO_GIT" = 0 ] && [ "$IN_PLACE" = 0 ]; } || { echo "--github needs a new target directory with git" >&2; exit 2; }
fi
if [ -n "$SOURCE_PATHS" ]; then
  [[ "$SOURCE_PATHS" =~ ^[A-Za-z0-9._/-]+(,[A-Za-z0-9._/-]+)*$ ]] || { echo "--source-paths must be a comma-separated list of directories" >&2; exit 2; }
fi
if [ -n "$CONTRACTS_TARGET" ]; then
  [[ "$CONTRACTS_TARGET" =~ ^[A-Za-z0-9_][A-Za-z0-9_.:/-]*$ ]] || { echo "--contracts-target must be a make target" >&2; exit 2; }
fi
if [ "$IN_PLACE" = 1 ]; then
  TARGET="$HARNESS"
else
  [ -n "$TARGET" ] || { echo "target directory is required" >&2; usage >&2; exit 2; }
  if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "target is not empty: $TARGET" >&2; exit 1
  fi
  mkdir -p "$TARGET"
  TARGET=$(cd "$TARGET" && pwd)
fi

if [ -z "$OWNER" ]; then
  if command -v gh >/dev/null 2>&1; then OWNER=$(gh api user -q .login 2>/dev/null || true); fi
  OWNER=${OWNER:-OWNER}
fi

if [ "$IN_PLACE" = 0 ]; then
  rsync -a \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    --exclude 'harness/decisions/' \
    --exclude 'harness/CHANGELOG.md' \
    --exclude 'harness/scripts/tests/' \
    --exclude 'harness/templates/' \
    --exclude '.markdownlint-cli2.jsonc' \
    --exclude 'Makefile' \
    --exclude 'README.md' \
    --exclude 'AGENTS.md' \
    --exclude '.claude/settings.json' \
    --exclude '.claude/settings.local.json' \
    --exclude '.github/actions/setup/action.yml' \
    --exclude '.github/CODEOWNERS' \
    "$HARNESS/" "$TARGET/"
fi

apply_template() {
  local src="$HARNESS/harness/templates/$1" dst="$TARGET/$2"
  mkdir -p "$(dirname "$dst")"
  sed -e "s/{{PROJECT_NAME}}/$NAME/g" -e "s/{{PROJECT_OWNER}}/$OWNER/g" "$src" > "$dst"
}
apply_template Makefile Makefile
apply_template AGENTS.md AGENTS.md
apply_template README.md README.md
apply_template settings.json .claude/settings.json
apply_template setup-action.yml .github/actions/setup/action.yml
apply_template CODEOWNERS .github/CODEOWNERS

if [ -n "$DOC_LANGUAGE" ]; then
  sed -i.bak -e "s/^doc_language: .*/doc_language: $DOC_LANGUAGE/" "$TARGET/harness/config.yml" && rm -f "$TARGET/harness/config.yml.bak"
fi
sed -i.bak -e "/^auto_merge_allowlist:/,/^[a-z]/ s/\"Morten-Moeller\"/\"$OWNER\"/" "$TARGET/harness/config.yml" && rm -f "$TARGET/harness/config.yml.bak"
if [ -n "$SOURCE_PATHS" ]; then
  awk -v paths="$SOURCE_PATHS" '
    /^source_paths:/ { print; n = split(paths, p, ","); for (i = 1; i <= n; i++) print "  - " p[i]; skip = 1; next }
    skip && /^[ \t]*-/ { next }
    { skip = 0; print }
  ' "$TARGET/harness/config.yml" > "$TARGET/harness/config.yml.new" && mv "$TARGET/harness/config.yml.new" "$TARGET/harness/config.yml"
fi
if [ -n "$CONTRACTS_TARGET" ]; then
  sed -i.bak -e "s|^contracts_generate_target: .*|contracts_generate_target: $CONTRACTS_TARGET|" "$TARGET/harness/config.yml" && rm -f "$TARGET/harness/config.yml.bak"
fi

if [ "$IN_PLACE" = 1 ]; then
  rm -rf "$TARGET/harness/decisions" "$TARGET/harness/templates" "$TARGET/harness/scripts/tests" \
         "$TARGET/harness/CHANGELOG.md" "$TARGET/.markdownlint-cli2.jsonc"
fi

cp "$HARNESS/HARNESS_VERSION" "$TARGET/HARNESS_VERSION"

if [ "$NO_GIT" = 0 ] && [ "$IN_PLACE" = 0 ] && [ ! -d "$TARGET/.git" ]; then
  default_branch=$(awk '$1 == "default_branch:" { print $2; exit }' "$TARGET/harness/config.yml")
  git -C "$TARGET" init -q -b "${default_branch:-main}"
  git -C "$TARGET" config core.hooksPath .githooks
fi

if [ -n "$GITHUB" ]; then
  git -C "$TARGET" remote add origin "git@github.com:$GITHUB.git"
  git -C "$TARGET" add -A
  git -C "$TARGET" commit -q -m "chore: bootstrap from ai-harness $(cat "$HARNESS/HARNESS_VERSION")"
  git -C "$TARGET" push -q -u origin HEAD
  (cd "$TARGET" && harness/scripts/setup-repo.sh --repo "$GITHUB")
fi

cat <<MSG
Project $NAME created in $TARGET (harness $(cat "$HARNESS/HARNESS_VERSION")).

Next steps:
  1. Fill test, typecheck and lint in Makefile            (harness/quality-gates.md)
  2. Fill .github/actions/setup/action.yml with the toolchain
  3. Fill project-rules/*.md and docs/domain/glossary.md
  4. Review harness/config.yml and harness/risk-matrix.yml
  Every other clone: make setup (git hooks)
MSG
if [ -z "$GITHUB" ]; then
  echo "  5. Create the GitHub repository, push, then: harness/scripts/setup-repo.sh"
fi
