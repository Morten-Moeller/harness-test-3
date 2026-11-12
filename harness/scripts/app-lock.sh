#!/usr/bin/env bash
# One lock per repository for running the application (decision 0020). verify takes it from
# starting the application to stopping it, implement for its end-to-end step, so only one worktree
# runs the application at a time.
#
# Usage:
#   app-lock.sh acquire --owner <name> [--wait <seconds>] [--stale <minutes>]
#   app-lock.sh release --owner <name>
#   app-lock.sh status
#
# The lock is the symbolic link ai-harness/app.lock in the git common directory, which every
# worktree of the repository shares; its target "<epoch seconds>:<owner>" is written in one step.
# acquire exits 0 when it took the lock or the owner holds it already, and 1 when another owner
# still holds it after --wait seconds (default 0); a lock older than --stale minutes (default 60)
# or one without a readable time is taken over. release exits 0 when the lock is free afterwards
# and 1 when another owner holds it. status prints the owner and the age in minutes, or "free".
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

CMD="${1:-}"
case "$CMD" in
  acquire|release|status) shift ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
OWNER=""
WAIT=0
STALE=60
need() { [ "$#" -ge 2 ] || { echo "$1 needs a value" >&2; exit 2; }; }
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) need "$@"; OWNER="$2"; shift 2 ;;
    --wait) need "$@"; WAIT="$2"; shift 2 ;;
    --stale) need "$@"; STALE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
case "$WAIT$STALE" in *[!0-9]*) echo "--wait and --stale take whole numbers" >&2; exit 2 ;; esac
[ "$CMD" = status ] || [ -n "$OWNER" ] || { echo "--owner is required" >&2; exit 2; }

common=$(git rev-parse --git-common-dir 2>/dev/null) || { echo "not a git repository" >&2; exit 2; }
case "$common" in /*) ;; *) common="$(pwd)/$common" ;; esac
mkdir -p "$common/ai-harness"
LOCK="$common/ai-harness/app.lock"

value() { readlink "$LOCK" 2>/dev/null || true; }
holder() { local v; v=$(value); case "$v" in *:*) printf '%s' "${v#*:}" ;; esac; }
age() { # seconds since the lock was taken; empty when the time is not readable
  local v since
  v=$(value)
  since=${v%%:*}
  case "$since" in ''|*[!0-9]*) return 0 ;; esac
  echo $(( $(date +%s) - since ))
}
link() { ln -s -n "$(date +%s):$OWNER" "$LOCK" 2>/dev/null; }

take() {
  local seen a moved
  link && return 0
  seen=$(value)
  [ -n "$seen" ] || return 1
  [ "$(holder)" = "$OWNER" ] && return 0
  a=$(age)
  if [ -n "$a" ] && [ "$a" -lt $(( STALE * 60 )) ]; then return 1; fi
  # Rename first: only one waiting process can move the stale link away. A link that changed in
  # between belongs to someone else and goes back.
  moved="$LOCK.stale.$$"
  if mv "$LOCK" "$moved" 2>/dev/null; then
    if [ "$(readlink "$moved" 2>/dev/null || true)" = "$seen" ]; then
      echo "stale lock of ${seen#*:} taken over" >&2
    else
      ln -s -n "$(readlink "$moved")" "$LOCK" 2>/dev/null || true
    fi
    rm -f "$moved"
  fi
  link
}

case "$CMD" in
  acquire)
    deadline=$(( $(date +%s) + WAIT ))
    until take; do
      if [ "$(date +%s)" -ge "$deadline" ]; then
        a=$(age)
        echo "busy: $(holder) holds the application lock since $(( ${a:-0} / 60 )) min" >&2
        exit 1
      fi
      sleep 5
    done
    echo "lock: $OWNER"
    ;;
  release)
    if [ ! -L "$LOCK" ]; then echo "free"; exit 0; fi
    if [ "$(holder)" != "$OWNER" ]; then echo "held by $(holder), not by $OWNER" >&2; exit 1; fi
    rm -f "$LOCK"
    echo "free"
    ;;
  status)
    if [ -L "$LOCK" ]; then
      a=$(age)
      echo "$(holder) $(( ${a:-0} / 60 ))"
    else
      echo "free"
    fi
    ;;
esac
