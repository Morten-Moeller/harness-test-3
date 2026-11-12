---
name: implement
description: Implement an approved spec up to a reviewed pull request - check gate G0, follow the plan in the spec, write code and tests on the feature branch, run the gates, review the branch and fix blocking findings before the push, open the pull request with the evidence per criterion, set the review status, wait for CI and fix failures caused by the change, then verify medium and high risk against the criteria. Stops only when the change leaves the approved plan.
when_to_use: Load when the user runs /implement or names an approved spec and wants it built, or when the skill spec continues after "Freigeben und umsetzen". Never for a spec that is not approved.
argument-hint: <spec id NNNN or path> [--worker]
---

# Implement

Stage 2 of `harness/workflow.md`. The merge is never part of this skill: low risk merges through
`auto-merge.yml`, medium and high risk after the person sets the label.

Run every step without a pause. Stop and ask only where a step says so.

## Worker mode

With `--worker` the skill runs inside an `implementer` agent of the skill `wave` (decision 0020),
in its own git worktree:

- Before step 1: note `git branch --show-current` as the start branch, `git fetch -q origin`, then
  `git switch <branch>` for the branch named in the prompt when it exists locally, otherwise
  `git switch -c <branch> origin/<default_branch>`. Delete the start branch with `git branch -D`
  when it is neither the default branch nor a branch `<type>/<NNNN>-<slug>`. Run the command
  `worktree_setup` from `harness/config.yml` (`make setup` when the key is missing).
- Every "stop and ask" ends the run with the report `Frage` of `.claude/agents/implementer.md`
  instead of `AskUserQuestion`. Resumed with the answer: write it into the spec as an answered
  question and continue at the same step.
- Step 10 is the report of `.claude/agents/implementer.md`.

## 1. Resolve and gate G0

1. The argument is a spec id or path. Read `docs/specs/NNNN-*.md`.
2. `status` must be `approved` in the front matter. Anything else: report the status and stop.
   Do not change the status.
3. Read: `AGENTS.md`, `harness/architecture.md`, `harness/testing.md`, the `project-rules/*.md` of
   the areas in the spec, `docs/domain/glossary.md`,
   `docs/architecture/overview.md`, the ADRs in `adrs`, `contracts/README.md` when `## Contracts`
   is not `keine`.
4. `harness/policies/adr.md` requires an ADR and `adrs` is empty: stop and report.

## 2. Branch

1. `git status --porcelain` must show no tracked changes. Otherwise stop and report.
2. On the branch `<type>/<NNNN>-<slug>` from `/spec`: stay. Otherwise `git fetch -q origin` and
   create it from `origin/<default_branch>` (`harness/config.yml`).
3. Spec front matter: `status: in Arbeit`, `updated` today.

## 3. Code and tests

- Follow `## Umsetzung` of the spec, `harness/architecture.md`, `harness/testing.md` and
  `project-rules/`; an ADR that names a rule number replaces that rule. Use the glossary terms.
  No comments in code. Simplified technical English in identifiers and messages; user-facing text
  through the project's i18n.
- Every acceptance criterion gets the test named in the plan, failing without the change, or the
  `/verify` check named there. A criterion that names a screen gets an end-to-end test when
  `project-rules/testing.md` has that level.
- Test data with the steps of `.claude/skills/test-data/SKILL.md`.
- Contracts: with the steps of `.claude/skills/contract/SKILL.md`, never by hand.
- **Stop and ask** with `AskUserQuestion` when the change needs files or contracts outside the
  plan that change what the spec promises, a decision the block `Entscheidungen` does not name (a
  new dependency, a contract or API change, a data model change or migration, a new module or
  service, a deviation from a rule), or when an edge case has no answer in the spec. No silent
  workaround. Small helpers next to planned files are inside the plan.

## 4. Gates

1. `make check`. A gate that prints `übersprungen` has no tool on this machine; CI runs it. Note
   it for the summary.
2. The end-to-end tests of the touched areas (`project-rules/testing.md`, table Areas, section
   End-to-end). When the application must run first and does not, and it cannot be started from
   this session: note the specs for the summary; CI or `/verify` runs them. Start the application
   only under the lock: `harness/scripts/app-lock.sh acquire --owner <branch> --wait 540` before,
   `harness/scripts/app-lock.sh release --owner <branch>` after stopping it, also when a test
   failed. Still busy after the wait: try again; note it when it stays busy.
3. A failing gate caused by this change: fix the change. A gate that fails on the base branch as
   well: report it with its output and stop. Never edit a gate, a test of someone else, an ignore
   file or a threshold.
4. `harness/scripts/risk-level.sh --base origin/<default_branch> --include-working-tree --format
   text`. A level above the one in the spec: **stop and ask** (continue with the higher level, or
   change the approach).

## 5. Commit and PR text

1. Commits: `<type>(<scope>): <summary> (<NNNN>)`, with the attribution line from the session.
   Several commits are fine; each one builds.
2. Spec front matter: `status: Review`, `updated` today. Commit it with the code.
3. Write the PR title `<type>(<scope>): <spec title> (<NNNN>)` and the body from
   `.github/pull_request_template.md` into scratchpad files: spec link, the `## Risiko` block
   (`harness/scripts/risk-level.sh --base origin/<default_branch> --format markdown` and the
   gates), ADR links or `keines nötig: <reason>`, the criteria table with the test or the
   `/verify` check per row.

## 6. Review before the push

1. Run the skill `review` without a PR number, with the planned title and body.
2. Blocking findings: fix them, `make check`, commit, run `review` again (incremental). At most two
   rounds. Blocking findings left after that stay open and go into the summary; never hide them.
3. Notes (non-blocking): fix the ones that are cheap and inside the plan; the rest go into the
   summary.

## 7. Push and pull request

1. `git push -u origin <branch>`.
2. `gh pr create --title "<title>" --body-file <body>`.
3. Low risk: spec front matter `status: done`, `pr: "#<n>"`, `updated` today. It reaches the
   default branch only with the merge. Commit `docs(specs): <NNNN> PR #<n>`, push. Medium and high
   risk: no commit here; `verify` writes the state in step 9.
4. Run the skill `review` with `<n>`. The result exists already; the skill sets the status
   `ai-review`.

## 8. CI

1. `gh pr checks <n> --watch` in the background; wait for its notification.
2. Failing checks other than `human-gate`: read the log (`gh run view <id> --log-failed`). Caused
   by this change: fix, `make check`, commit, push, run `review` with `<n>`, watch again. At most
   two rounds. Not caused by this change (a missing tool, a check that fails on the base branch):
   report it with its output.
3. `human-gate` is red for medium and high risk until `verify` passed (step 9) and the person set
   the label. That is the expected state.
4. The PR body changes when the facts change (a criterion now has another test): edit it with
   `gh pr edit <n> --body-file <file>`.

## 9. Verify

Medium and high risk only; low risk merges after the required checks.

1. Run the skill `verify` with `<n>`. It writes the criteria table into the PR body, sets the spec
   to `done` or `in Arbeit`, pushes it, runs `review` and sets the commit status `verified`.
2. A criterion `nicht erfüllt` or a failing check caused by this change: fix it inside the plan,
   `make check`, commit, push, run `review` with `<n>`, then `verify` again. At most two rounds;
   what is left goes into the summary.
3. `gh pr checks <n> --watch` in the background after the last push; wait for its notification.

## 10. Summary

In the chat, in `doc_language`:

- PR URL, risk level, the gates that apply.
- The review result: blocking findings left, notes, one line each with file and line.
- The verification: the status `verified`, criteria `nicht erfüllt` or `nicht prüfbar` with the
  reason.
- Gates skipped locally, end-to-end specs not run, failing checks with output.
- The next step: low risk merges after the required checks; medium and high risk wait for the
  person's review and the label `human-approved` after the last push, then GitHub merges.

Do not report passing checks. Labels, PR reviews and the merge are not part of this skill.
