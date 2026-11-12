---
name: review
description: Review a pull request or the local branch in one run - deterministic rule check (harness/scripts/review-rules.sh), then the AI reviews its risk level needs (code always, security from medium, architecture for high risk or contract changes) by read-only reviewer agents, incremental against the last reviewed commit and as one combined agent run for small diffs. Saves the result, sets the commit status ai-review and reports the findings in the chat; no PR comment.
when_to_use: Load when the user runs /review, after every push of this session to a pull request branch, from implement before the push (no PR number), or when CI runs it with a PR number.
argument-hint: [PR number] [code] [security] [architecture] [--force]
---

# Review

Rules, cost model and states: `harness/review.md`. The merge is never part of this skill.

This session collects data, decides which reviews run, starts the agents, saves the result and
sets the status. It does not review code itself. The agents read and return findings; they start
without this conversation and on the model of their agent file.

| Mode | Argument | Head | Base |
|---|---|---|---|
| PR | a PR number | `headRefOid` | `origin/<baseRefName>` |
| local | none, on a branch before the push | `git rev-parse HEAD` | `origin/<default_branch>` (`harness/config.yml`) |

Work directory: `<scratchpad>/review-<first 7 characters of the head>/`. `RS` is
`harness/scripts/review-status.sh`.

## 1. Collect

1. PR mode: `gh pr view <n> --json title,body,author,headRefOid,baseRefName,files,commits`,
   `git fetch -q origin <base> "pull/<n>/head"`, `files.txt` from `files`, `diff.patch` from
   `gh pr diff <n>`, `commits.txt` from `commits[].oid`.
   Local mode: `git fetch -q origin <base>`, `files.txt` from `git diff --name-only <base>...HEAD`,
   `diff.patch` from `git diff <base>...HEAD`, `commits.txt` from
   `git rev-list --reverse <base>..HEAD`.
2. Dependabot author: the update type is the line `update-type:` in the message body of the first
   commit. Pass it to `risk-level.sh` as `--dependabot <type>`.
3. `harness/scripts/risk-level.sh --files-from files.txt --diff-from diff.patch --format json`:
   fields `level` and `lines`.
4. Rule check into `rules.md`. Exit 1 means blocking rule findings; continue.
   - PR mode: `harness/scripts/review-rules.sh --pr <n> --format markdown`.
   - Local mode: `harness/scripts/review-rules.sh --files-from files.txt --diff-from diff.patch
     --base-ref <base> --head-ref HEAD --level <level> --title "<planned PR title>"
     --body-from <planned PR body> --format markdown`.
     Without a planned body yet, leave `--body-from` out and ignore the `kriterium` rows.
5. Spec: `docs/specs/NNNN-*.md` from `(NNNN)` in the title, a path in the body or the branch name
   `<type>/<NNNN>-<slug>`. In the harness repository (`harness/templates/` exists) a
   `harness/decisions/NNNN-*.md` of the change takes its place.

## 2. Plan

| Review | Needed when | Agent |
|---|---|---|
| code | always | `code-reviewer` |
| security | level medium or high | `security-reviewer` |
| architecture | level high, or a file under `contracts/` or `docs/architecture/` | `architecture-reviewer` |

Type arguments (`code`, `security`, `architecture`) restrict the run to those reviews.

State of each review. `<old>` is `RS last --commits-from commits.txt`: the newest commit of the
change with a saved result. Its first line names the reviews it covers (`reviews=`).

| Case | State |
|---|---|
| `--force` | `voll` |
| `RS load --sha <head>` exists and covers the review | `vorhanden` |
| `<old>` exists, covers the review, and `git merge-base --is-ancestor <old> <head>` | from the delta, below |
| anything else (first review, rebase, force push, review newly needed) | `voll` |

Delta: `git diff --name-only <old> <head>`, only the paths that are also in `files.txt`, into
`delta.txt`.

- No path left, or `risk-level.sh --files-from delta.txt --format level` prints `low`:
  `übernommen`.
- Otherwise `inkrementell`: `git diff <old> <head> -- <delta paths>` into `delta.patch`,
  `RS load --sha <old>` into `prev.md`.

Print one line per review: review, state, reason. Every review `vorhanden`: go to step 5.

## 3. Agents

**Combined run**: two or more reviews in state `voll` or `inkrementell`, and the reviewed diff has
at most `review_combined_max_lines` changed lines (`harness/config.yml`). The reviewed diff is
`diff.patch` for `voll` and `delta.patch` for `inkrementell`; count the lines that start with `+`
or `-`, without the `+++` and `---` headers, and take the largest of the reviews that run. One
Agent call with subagent type `code-reviewer` covers all of them, one section per review.

**Separate runs** otherwise: one Agent call per review, all in the same message.

Prompt, filled in and nothing more:

```text
Review <PR #<n> | the local branch>, head <sha>, risk <level>.
Mode: <voll | inkrementell seit <old sha>>.
Diff: <diff.patch | delta.patch>. Changed files: <files.txt>.
Spec: <path | keine>.
Rule check: <rules.md>. Its items are checked; do not report them again.
[inkrementell] Previous result: <prev.md>. Mark each previous finding behoben or offen.
[combined] Sections: <Code | Sicherheit | Architektur>. Sicherheit follows
.claude/agents/security-reviewer.md, Architektur follows .claude/agents/architecture-reviewer.md.
Return per section the table of the agent file and one line "Nicht geprüft: ...".
```

Wait for every agent.

## 4. Result

Write `result.md` in `doc_language` (`harness/config.yml`) and save it:
`RS save --sha <head> --file result.md`.

```text
<!-- ai-review state=<success|failure> level=<level> reviews=<code,security,architecture> blocking=<n> notes=<n> -->
Review <head sha 7>, <voll | inkrementell seit <old 7> | übernommen von <old 7>>

Blockierend
1. `<Datei:Zeile>` <Befund in einem Satz>. Folge: <Szenario>. Vorschlag: <Änderung>.

Hinweise
1. `<Datei:Zeile>` <Befund>. Vorschlag: <Änderung>.

Frühere Befunde: <Befund: behoben | offen>, ...
Regelprüfung: <blocking and other rows of rules.md | keine Befunde>
Nicht geprüft: <only what matters for the risk level of the change>
```

- `reviews=` lists every review the result covers: the ones run now and the `vorhanden` or
  `übernommen` ones.
- `blocking` = blocking findings of the agents + previous blocking findings that are `offen` +
  blocking rows of `rules.md`. `state=failure` when `blocking` is above 0.
- Leave out empty sections. One finding per line; no tables.
- `übernommen`: the result of `<old>` with the new second line, the current rule check and
  `blocking` counted again.

## 5. Status

- PR mode: `RS publish --sha <head>`, with `--note "übernommen von <old 7>"` for `übernommen`.
  Also for `vorhanden`: after a push the status of the head is not set yet.
- Local mode: no status. After the push, the run in PR mode finds the result as `vorhanden`.

## 6. Chat

Print `result.md` without its first line. Then one line with the next step:

- `state=failure`: the blocking findings are fixed, then `/review` again.
- level low: GitHub merges after the required checks.
- level medium or high: `verify` for the head (in this session, or `/verify <n>`), then the label
  `human-approved` after the person's own review and the last push merges the PR.

Inside `implement` return the findings to it and skip the next-step line.
