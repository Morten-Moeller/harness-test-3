# Policy: risk levels

Every change gets one of three risk levels. The level decides which human gates apply
(`human-approval.md`), which AI reviews run, and whether the change may merge automatically
(`auto-merge.md`).

## Levels

| Level | Definition | Examples |
|---|---|---|
| **low** | A mistake is visible at once, cheap to revert and reaches no data, no contract and no security boundary. | documentation, formatting, comments, test files outside the source tree (for example `tests/`), dependency patch or minor updates by Dependabot |
| **medium** | A mistake changes behaviour for users or developers, but stays inside the system and is revertable with one more PR. | feature code and its tests inside the source tree, UI with user effect, new dependency, build changes, refactoring across modules |
| **high** | A mistake reaches data, money, identity, other systems or the rules of this repository. | `contracts/`, database migrations, authentication, authorisation, cryptography, payment, data deletion or export, infrastructure and deployment, secrets, `AGENTS.md`, `harness/policies/`, `.github/workflows/` |

A change with files on several levels has the highest of them.

## Escalators

Escalators raise the level by one step. They never lower it.

| Escalator | Trigger |
|---|---|
| size | more than `low_risk_max_lines` changed lines (see `harness/config.yml`) raises low to medium |
| dependency manifest | a change to a package manifest or lock file is at least medium, unless it is a Dependabot patch or minor update with no other files |
| major version | a dependency major bump is at least medium and needs an ADR when the dependency is a framework |
| keywords | added lines that match the `keywords` list in `harness/risk-matrix.yml` (for example `password`, `secret`, `DROP TABLE`) raise one step; low files and files under `keyword_exempt` (generated wrapper scripts such as `mvnw`) do not count |
| gate markers | added lines outside Markdown that switch off a check (`gate_markers` in `harness/risk-matrix.yml`, for example `.skip(`, `@ts-ignore`) raise low to medium |

## How the level is computed

1. `harness/scripts/risk-level.sh` reads the changed files of a branch or PR and matches them
   against `harness/risk-matrix.yml`. Files that match no pattern count as medium.
2. The script applies the escalators and prints the level and the reasons.
3. `/risk` runs the script, reads the diff and may raise the level with a written reason. It never
   lowers it. The reason goes into the PR body under `## Risiko` when `/implement` opens the PR,
   or into that section of the PR body when `/risk` runs on an open PR.
4. CI runs the same script, labels the PR `risk:low`, `risk:medium` or `risk:high` and uses the
   result in `ai-review.yml` (`review-rules`) and `auto-merge.yml`. The label is informational; the
   jobs recompute.

## Who may lower a level

Only a person, with the label on a PR that changes `harness/risk-matrix.yml`. An agent may write
that change; the matrix is high risk, and CI judges the PR by the matrix of the base branch. A
single PR is never lowered by hand; the matrix is changed so the rule holds for the next change as
well.

## Unknown is medium

A new directory, a new file type or a tool nobody has seen before matches no pattern. The script
treats it as medium so a person looks at it once. Add the pattern to the matrix after that.
