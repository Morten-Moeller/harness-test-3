# Workflow

Every change moves through three stages. The person decides twice: on the spec with its plan, and
on the pull request. The risk level of the change decides whether the second decision is needed.

```text
  /spec                    G0 + G1             implement                       G2           merge
Spec + plan (draft) ──► approved in the ──► code, gates, review, PR, CI ──► label ──────► GitHub
                        session                                          (medium, high)
                                                                          low: none
```

## Roadmap and waves

For a new project, or a goal that needs several specs (decisions 0019 and 0020):

- Skill `/roadmap <goal>`: asks about the goal, the users, what is out of scope, quality targets
  and constraints, and writes `docs/roadmap.md` with the specs in waves, the ADRs of the basic
  decisions and the specs of the next wave. One approval question approves all of it and is G0 for
  each spec of the wave; each spec is committed on its own branch. `/roadmap next` writes the
  specs of the following wave from the code that exists then.
- Wave 1 of a new project is the skeleton alone. The specs of a later wave do not depend on each
  other and change separate areas.
- Skill `wave` (`/wave <NNNN> …`): `harness/scripts/wave-check.sh` compares the plans; specs that
  overlap, or more than `parallel_max` (`harness/config.yml`), wait. One `implementer` agent per
  spec runs `implement` in worker mode in its own git worktree, up to a verified pull request. The
  session asks the person the questions of the workers and reports one table. G2 and G3 stay per
  pull request.
- One worktree at a time runs the application: `verify` and the end-to-end step of `implement`
  take `harness/scripts/app-lock.sh`. Tests take free ports (T3.6 in `harness/testing.md`).

## Stage 1: Spec

- Skill: `/spec <topic>`. Output: `docs/specs/NNNN-<slug>.md`. The front matter holds the state of
  the spec; `make specs` prints the overview.
- The spec names the goal, the scope, the terms from `docs/domain/glossary.md`, numbered acceptance
  criteria A1..An that a test or a walk-through can check, the contracts it touches, the
  implementation plan (`## Umsetzung`: the block `Entscheidungen` that the person reads, then the
  files with full paths, the steps, one test per criterion), the risk level from
  `harness/scripts/risk-level.sh` and whether an ADR is required (`harness/policies/adr.md`). A
  required ADR is written with the spec.
- Open questions are listed, not resolved by guessing. The skill asks them together with the
  approval.

**Gates G0 and G1, spec and plan approval.** `/spec` ends with one question to the person:
approve and implement, approve only, or change. On approval it writes `status: approved`, creates
the branch `<type>/<NNNN>-<slug>` and commits the spec there. Agents never write `approved`
without that answer.

## Stage 2: Implementation

- Skill: `implement` (`/implement <spec-id>`, or straight from `/spec`). It runs without a pause:
  code and tests by the plan, `make check`, a review of the branch before the push with fixes for
  blocking findings, push, pull request from `.github/pull_request_template.md`, the status
  `ai-review`, waiting for CI and fixing failures caused by the change.
- It stops only when the change leaves the approved plan: a higher risk level than in the spec,
  files or contracts that change what the spec promises, or an edge case the spec does not answer.
- The spec status moves to `in Arbeit`, then `Review` when the PR is open.

## Stage 3: Verification

Three independent sources of evidence:

1. **Quality gates** in CI: `test`, `typecheck`, `lint`, `sast`, `deps`, `drift`, `e2e`. All
   required; `drift` and `e2e` pass without running when the project has no generator or no
   end-to-end tests in CI.
   Locally a gate without its tool is skipped and named; CI always runs it.
2. **Reviews**: the skill `review`, in the developer's Claude Code session, before the push and
   after every later push. A script checks the rules that need no judgement
   (`harness/scripts/review-rules.sh`). Reviewer agents run the AI reviews the level needs: code
   always, security from medium, architecture for high or whenever `contracts/` or
   `docs/architecture/` changed. A second run reviews only what changed since the last reviewed
   commit. The result is the commit status `ai-review` and a report in the session, no PR comment.
   CI runs the rule check again as the required job `review-rules`. Details: `harness/review.md`.
3. **`verify`**: walks the acceptance criteria of the spec, runs the affected tests, walks the
   application when a criterion names a screen, writes the result into the criteria table of the
   PR body, sets the spec status to `done` or `in Arbeit` and the commit status `verified` on the
   head. `implement` runs it for medium and high risk once CI passed; the session runs it again
   after a later push of its own; `/verify <PR>` starts it by hand. Always before the merge
   (decision 0018).

**Gate G2, merge decision.** Medium and high risk need a review by a person: the director reads
the PR and sets the label `human-approved` after the last push, or a second person approves the
head commit (required when `second_reviewer_for` in `harness/config.yml` names the level). The
`human-gate` check in `auto-merge.yml` passes only then, and the same workflow enables auto-merge.
Low risk passes the gate without a review.

**Gate G3, verification evidence.** High risk needs the status `verified` = `success` on the head
commit; `human-gate` checks it before G2. `verify_required_for` in `harness/config.yml` sets the
levels (`high` by default, `medium` for medium and high, `""` off). Pull requests by bots are
exempt.

## Merge

- GitHub merges with auto-merge after every required check is green. `auto-merge.yml` enables it
  for low risk when the conditions in `harness/policies/auto-merge.md` hold, and for medium and
  high risk when `human-gate` passed.
- No agent merges. `gh pr merge` is denied for agents.
- The spec is `done` with the PR number before the merge, written by `verify` (medium, high) or
  `implement` (low) on the PR branch. It reaches the default branch with the merge, so no pull
  request after the merge is needed.

## Spec status values

| Status | Set by | Meaning |
|---|---|---|
| `draft` | `/spec`, `/roadmap` | written, not approved |
| `approved` | `/spec` or `/roadmap` on the person's answer, or a person | G0 and G1 passed, implementation may start |
| `in Arbeit` | `implement`, `verify` | code in progress or findings to fix |
| `Review` | `implement` | PR open, waiting for gates, reviews, verification |
| `done` | `verify`, `implement` for low risk, on the PR branch | every criterion met; on the default branch only through the merge |
| `blockiert` | anyone | waits for a decision; the note names it |

## Rules that hold in every stage

- Never weaken a check, a test or a policy to make a change pass. Surface the conflict.
- Edge cases without an answer in the spec go back to the person. No silent workarounds.
- A skill changes only the front matter of its own spec and only its own section of the PR body.
- Report failing checks with their output. Do not report passing checks.
