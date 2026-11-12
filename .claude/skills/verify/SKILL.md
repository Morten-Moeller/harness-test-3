---
name: verify
description: Verify an open pull request against the acceptance criteria of its spec before the merge - run make check and the affected tests, walk the application when a criterion names a screen, write the result table into the PR body, set the spec to done or in Arbeit and the commit status verified that the human gate reads for G3.
when_to_use: Load when the user runs /verify, from implement once CI passed on a medium or high risk pull request, or after a push of this session to an open medium or high risk pull request whose head has no status verified. Never for a merged or closed pull request.
argument-hint: <PR number | spec id>
---

# Verify

Stage 3 of `harness/workflow.md`, before the merge decision (gate G3,
`harness/policies/human-approval.md`). The merge is never part of this skill. The result is the
criteria table in the PR body, the state in the spec front matter and the commit status
`verified` on the head.

## 1. Resolve and gate

1. Argument is a PR number or a spec id. From a PR: `gh pr view <n> --json state,title,headRefName,
   headRefOid,baseRefName,body,files,statusCheckRollup`; the spec id is in the title `(NNNN)`, the
   body or the branch name `<type>/<NNNN>-<slug>`. From a spec id: the field `pr` of its front
   matter, otherwise the open PR of its branch (`gh pr list --head <branch>`). No PR: report and
   stop.
2. `state` must be `OPEN`. A merged or closed PR: report and stop; a finding after the merge is a
   new change.
3. Read the spec: acceptance criteria, verification plan. In the harness repository
   (`harness/templates/` exists) the decision `harness/decisions/NNNN-*.md` of the change takes its
   place, with the criteria of the PR body. No spec and no decision: only the automated checks
   count, the table has one row `Automatische Checks`. Read `project-rules/testing.md` for how
   affected tests are selected and how the browser checks run.
4. `statusCheckRollup` has `verified` with `SUCCESS` for the head: this state is verified. Report
   and stop.

## 2. Scope

Write the scope down before testing:

| Changed files | Automated | Browser |
|---|---|---|
| only docs, tests, config | `make check` | no |
| source paths (`harness/config.yml`) | `make check`, the unit, integration and end-to-end tests of the touched areas (`project-rules/testing.md`) | yes, for every criterion that names a screen, button or text and has no end-to-end test |
| `contracts/` | `make check`, contract validation, consumers' tests | as above |

No criterion names a screen: the body says `Kein Browser-Test: <Grund>`.

## 3. Check out

1. `git status --porcelain` must show no tracked changes. Otherwise stop and report.
2. Note the current branch. `git fetch origin`, `git checkout <headRefName>`,
   `git merge-base --is-ancestor origin/<base> HEAD`. Behind the base: note it in the body, do
   not rebase.
3. The project's services, when the criteria need them: start or ask as `project-rules/testing.md`
   says. Ask the person with `AskUserQuestion` when a service runs outside this session. Start the
   application only under the lock (decision 0020):
   `harness/scripts/app-lock.sh acquire --owner <headRefName> --wait 540`; still busy: try again.
   Release it with `harness/scripts/app-lock.sh release --owner <headRefName>` once the services
   are stopped after step 5, also when a check failed.

## 4. Automated checks

Run `make check` and the tests of the touched areas, end-to-end included. Test data with the steps
of `.claude/skills/test-data/SKILL.md`. Keep the output of every failing check. Never weaken a
check or a test to make it pass. A gate that prints `übersprungen` did not run; the line
`Automatisch` names it, and the CI result of that gate counts. Started from `implement`: its gate
results count when the head changed since only under `docs/specs/`.

## 5. Browser walk

Only when the scope says yes and a browser tool is available in this session (the Chrome skill or
the project's Playwright setup named in `project-rules/testing.md`). None available: every screen
criterion is `nicht prüfbar: kein Browser in dieser Session`.

Walk every criterion that names a screen. Screenshot before and after each action into the
scratchpad. Record per criterion `erfüllt`, `nicht erfüllt` (what was seen instead),
`nicht prüfbar` (why).

## 6. PR body

Replace the section `## Akzeptanzkriterien` of the PR body (`gh pr view <n> --json body`) and
write it back with `gh pr edit <n> --body-file <file>`. No PR comment. Language: `doc_language`.

```text
## Akzeptanzkriterien

Geprüft: <YYYY-MM-DD>, Commit <checked SHA>, Branch hinter <base>: <ja/nein>
Automatisch: make check <grün | FEHLER: Gate>; Tests <Auswahl>: <grün | FEHLER: ...>
Browser: <Umfang | Kein Browser-Test: Grund>

| Kriterium | Nachweis | Ergebnis |
|---|---|---|
| A1 | Test `<pfad>` / Browser: was zu sehen war | erfüllt / nicht erfüllt / nicht prüfbar |
```

The output of a failing check goes to the chat, not into the body.

## 7. Spec state

Passed means: every check green and no criterion `nicht erfüllt`. `nicht prüfbar` alone does not
block it; name it in the summary so the person decides.

- Passed: `status: done`, `pr: "#<n>"` in the spec front matter. It reaches the default branch
  only with the merge, so `done` is true there. Otherwise `status: in Arbeit`.
- `updated` today. `note`: the criteria `nicht prüfbar` or the failing check, one line, or
  `alle Kriterien erfüllt`.
- Commit only the front matter on the PR branch: `docs(specs): <NNNN> <done|in Arbeit> nach
  Test`, with the attribution line from the session. Push. Then run the skill `review` with `<n>`;
  the new commit changes only `docs/specs/`, so its state is `übernommen`.
- No spec (the harness repository, a change without spec) or nothing changed: no commit.

## 8. Status

`harness/scripts/review-status.sh verify --sha <head> --state <success|failure> --description
"<YYYY-MM-DD>, geprüft auf <checked SHA 7>[, <n> nicht prüfbar]"`. `<head>` is the commit after the
push of step 7 (`git rev-parse HEAD`), or the checked commit when step 7 made none. `success` when
passed, `failure` otherwise. A later push has no status; `human-gate` then fails for the levels in
`verify_required_for` (`harness/config.yml`) until `verify` runs again.

## 9. Summary

PR, spec status, the status `verified`, failing checks with output, criteria not met or not
testable, the branch checked out before. The working tree stays on the PR branch. Do not report
passing checks. Outside `implement`, the next step: the person reads the PR and sets the label
`human-approved` after this push; started from `implement`, return the result to it.
