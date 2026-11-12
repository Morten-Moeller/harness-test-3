# Review

`/review [PR]` is the one trigger for every review a change needs. A script checks what needs no
judgement. Reviewer agents check the rest, and only what is new since the last review. The result
is the commit status `ai-review` and a report in the session; there is no PR comment
(decision 0009).

```text
/review [PR]
  1. collect        PR data or local branch, diff, risk level, spec
  2. rule check     harness/scripts/review-rules.sh            no model, seconds
  3. plan           which reviews, which state per review
  4. agents         code-reviewer, security-reviewer, architecture-reviewer
  5. result         .git/ai-harness/review/<sha>.md            harness/scripts/review-status.sh save
  6. status         ai-review on the head commit               PR mode only
  7. chat           blocking findings, notes, next step
```

`implement` runs `/review` without a PR number before the push. After the push the head commit has
a result already, and `/review <PR>` only sets the status. The session runs `/review <PR>` after
every later push of its own.

## Rule check

`harness/scripts/review-rules.sh` runs in `/review` and again in CI (required job `review-rules`,
copy of the script from the base branch, also on every edit of the PR body). Its findings go into
the result of `/review` and into the job summary. A blocking rule finding fails `review-rules`
even when `ai-review` is green.

| Rule | Checks | Blocking |
|---|---|---|
| `spec` | the PR names a spec, `(NNNN)` in the title or `docs/specs/NNNN-*.md` in the body, and its status is not `draft` | missing spec from medium risk; spec in `draft` always |
| `adr` | a high-risk PR links an ADR: body, changed files or `adrs:` of the spec | yes |
| `entscheidung` | an accepted ADR or decision changes only in its `Status:` line | yes |
| `gate` | added lines that switch off a check (`.skip(`, `@ts-ignore`, `nolint`, `continue-on-error: true`, ...), changed gate files (`Makefile`, `*.mk`, ignore files, linter configs) | switched-off check without a line `Gate-Änderung: <Grund>` in the PR body |
| `kommentar` | comment lines added in code under `source_paths` (AGENTS.md) | no |
| `generiert` | changed files with a generated-file header | no |
| `kriterium` | every acceptance criterion of the spec has a row with evidence in the PR body | yes |
| `contract` | a change under `contracts/` is named in the `## Contracts` section of the spec | yes |
| `doku` | a Markdown file with `sources:` globs in its front matter, whose sources changed while the file did not | no |

The patterns for switched-off checks are the list `gate_markers` in `harness/risk-matrix.yml`.
`risk-level.sh` reads the same list and raises a low-risk PR with such a line to medium, so it
never merges automatically (`harness/policies/auto-merge.md`). CI also sets the label
`needs-human` on any `gate` finding and removes it again when a later run finds none and the last
`labeled` event of the label came from `github-actions[bot]`. To keep a label that CI set, remove
it and set it again; then the last event is a person's.

The scripts read the matrix and the config each with their own few lines of awk. They stay
self-contained on purpose: CI copies single scripts from the base branch into a temporary
directory, where a shared helper file would be missing (decision 0008).

Dependabot PRs skip `spec` and `adr`. A project switches a rule off in `harness/config.yml`
(`review_rules_disabled`).

In the harness repository itself a decision record in `harness/decisions/` takes the place of the
spec and of the ADR: the repository has no `docs/specs/` of its own, because `docs/` is the project
template.

## Which reviews

| Review | Needed when | Agent |
|---|---|---|
| code | always | `code-reviewer` |
| security | risk medium or high | `security-reviewer` |
| architecture | risk high, or a file under `contracts/` or `docs/architecture/` | `architecture-reviewer` |

## State per review

The result of a run is kept in `.git/ai-harness/review/<sha>.md`: local, untracked, shared by the
worktrees of a clone. Its first line names the state, the level, the reviews it covers and the
counts. The last reviewed commit is the newest commit of the change with such a result.

| State | When | Cost |
|---|---|---|
| `vorhanden` | the head commit has a result that covers the review | none, the status is set again |
| `übernommen` | the PR files changed since then are none, or only low-risk files | none |
| `inkrementell` | the reviewed commit is an ancestor of the head | an agent on the delta diff, with the previous findings |
| `voll` | first review, rebase or force push, a review newly needed, no saved result on this machine, or `--force` | an agent on the whole diff |

## Status and report

`harness/scripts/review-status.sh publish` sets `ai-review` on the head commit: `success` without
blocking findings, `failure` with them. The description names the reviews and the counts, for
example `Code, Sicherheit: 0 blockierend, 2 Hinweise`. The ruleset requires the status. Until it is
set, GitHub shows it as expected, not as failed.

The report in the session lists the blocking findings first, one per line with file and line, the
consequence and a proposal; then the notes; then the previous findings and the rule check, each in
one line. Empty sections are left out.

Dependabot patch and minor updates get `ai-review` from CI without an agent: the gates `deps` and
`sast` check them, and the rule check runs as for every PR.

## Cost control

- The agents start without the conversation of the session and read only the diff and what it
  touches.
- Model and effort are set in `.claude/agents/*.md` (default: Sonnet, effort medium). Raise them
  there for a project that needs it.
- When the diff under review has at most `review_combined_max_lines` changed lines
  (`harness/config.yml`), one agent run covers all reviews. For an incremental run that is the
  delta, not the whole PR.
- Secrets and vulnerable dependencies are left to the gates `sast` and `deps`.
- The built-in `/code-review` and `/security-review` skills are not part of `/review`. Run them by
  hand on a PR that needs a deeper look.

## CI without a session

With the secret `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` the job `review` of `ai-review.yml`
runs `/review <PR>` and sets the same status. CI has no saved results, so every run there is
`voll`.
