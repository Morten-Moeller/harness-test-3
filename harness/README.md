# AI Development Harness

The harness is the fixed part of every project: how agents and people move a change from an idea
to a merged pull request, which checks a change must pass, and which decisions stay with a person.
The project context (domain, specs, ADRs, contracts, project rules, source code) lives next to it
and is owned by the project.

```text
AI Development Harness
│
├── Workflow                  harness/workflow.md
│   ├── Spec → Implementation → Verification
│   ├── Human Gates G0–G3, decided at two points: spec approval and label
│   └── Risk Assessment       harness/policies/risk.md, harness/risk-matrix.yml
│
├── Skills / Agents           .claude/skills/, .claude/agents/
│   ├── /roadmap  /spec  /adr  /domain  /contract
│   ├── /risk  /implement  /verify  /wave  test-data
│   ├── implementer agent: one spec of a wave in its own worktree
│   └── /review  rule check + code, security, architecture review by level   harness/review.md
│                result: commit status ai-review, findings in the session
│
├── Baseline                  harness/architecture.md (A1-A7), harness/testing.md (T1-T7)
│                             a project replaces a rule with an ADR that names it
│
├── Quality Gates             harness/quality-gates.md, Makefile, .github/workflows/quality-gates.yml
│   ├── test  typecheck  lint
│   ├── sast  deps  drift
│   └── e2e (optional)  precommit (optional)
│
└── Policies                  harness/policies/
    ├── When is an ADR required?            adr.md
    ├── When is human approval required?    human-approval.md
    ├── What is low / medium / high risk?   risk.md
    └── What may be merged automatically?   auto-merge.md

Project Context
│
├── AGENTS.md                 user-owned control file, read by every agent
├── docs/
│   ├── domain/               glossary, bounded contexts, invariants
│   ├── adr/                  architecture decision records
│   ├── roadmap.md            goal, waves of specs (/roadmap)
│   ├── specs/                one spec per change, state in its front matter (make specs)
│   └── architecture/         system overview, module boundaries
├── contracts/                API, event and schema contracts
├── project-rules/            frontend.md, backend.md, testing.md
└── src/                      source code
```

## How the pieces connect

1. `/spec <topic>` asks, writes the spec with its implementation plan and ends with one question:
   approve and implement, approve only, or change. The answer of the person is gates G0 and G1.
   For a new project or a larger goal `/roadmap` does this for a whole wave of specs, and `wave`
   implements them in parallel, one worktree per spec.
2. `implement` follows the plan: code and tests, `make check`, a review of the branch with fixes
   for blocking findings, push, pull request, the commit status `ai-review`, waiting for CI. For
   medium and high risk it then runs `verify`: the acceptance criteria, the evidence in the PR
   body, the commit status `verified`. It stops only when the change leaves the plan.
3. CI runs the quality gates, computes the risk level, labels the PR and runs the rule check again
   (`review-rules`). The session reviews and verifies every later push of its own.
4. Low risk with green checks merges automatically. Medium and high risk merge automatically after
   the person reads the PR and sets the label `human-approved` (gate G2; G3, the status
   `verified`, for high).

## Harness-owned and project-owned files

Harness-owned files come from this repository and are refreshed with
`harness/scripts/update.sh`. They are listed in `harness/owned-paths.txt`. Everything else is
project-owned: the project edits it freely, the harness never overwrites it.

| Harness-owned | Project-owned |
|---|---|
| `harness/` (except `decisions/` and `CHANGELOG.md` of the harness repository itself) | `AGENTS.md`, `CLAUDE.md` |
| `.claude/settings.json`, `.claude/hooks/`, `.claude/skills/`, `.claude/agents/` | `docs/`, `contracts/`, `project-rules/`, `src/` |
| `.github/workflows/*.yml`, `.github/pull_request_template.md` | `Makefile`, `.github/actions/setup/`, `.github/dependabot.yml`, `.github/CODEOWNERS` |
| `HARNESS_VERSION` | `harness/config.yml` and `harness/risk-matrix.yml` after the first copy |

`harness/config.yml` and `harness/risk-matrix.yml` are copied once by `bootstrap.sh` and then belong
to the project. `update.sh` shows a diff for them and does not overwrite.

## Starting a new project

```bash
harness/scripts/bootstrap.sh /path/to/new-project --name my-project
cd /path/to/new-project
# 1. fill the gate targets in Makefile (test, lint, typecheck)
# 2. fill .github/actions/setup/action.yml with the toolchain setup
# 3. fill project-rules/*.md and docs/domain/glossary.md
# 4. review harness/config.yml and harness/risk-matrix.yml
```

`bootstrap.sh` copies the template with its dotfiles (`.claude/`, `.github/`) into an empty
folder. Copy by hand loses them. Options: `--source-paths frontend/src,backend/src/main` writes
`source_paths` of `harness/config.yml`; `--github owner/name` runs `setup-repo.sh` at the end.

`setup-repo.sh` creates the labels, enables auto-merge on the repository and imports the branch
ruleset. Rulesets need a public repository or GitHub Pro; without one the script says so, and
`auto-merge.yml` does not enable auto-merge on a branch without required checks. No secret is
needed: the reviews run in the session. Optional: `claude setup-token` and
`gh secret set CLAUDE_CODE_OAUTH_TOKEN` let CI run `/review` itself (works with a Claude
subscription); `AUTOMERGE_TOKEN` (a PAT) lets auto-merge work on Dependabot PRs.

## Updating a project to a newer harness

```bash
harness/scripts/update.sh /path/to/harness-checkout
git diff --stat
```

The script copies the harness-owned paths, keeps the project-owned ones and prints what changed.
Skills and agents of the project next to the harness ones stay (`.claude/skills/*/` in
`harness/owned-paths.txt`); a harness skill that the project changed is overwritten.
The project reviews the diff and commits it as a normal pull request. Breaking changes between
harness versions are listed in `harness/CHANGELOG.md` of the harness repository.

## Enforcement layers

| Rule | Enforced by |
|---|---|
| Agents do not edit `AGENTS.md`, `CLAUDE.md`, the policies, `human-gate.sh`, `auto-merge.yml`, the settings, the hooks | `permissions.deny` `Edit(...)` rules in `.claude/settings.json`; the guard hook for shell writes |
| A pull request is not judged by rules it changes itself | CI reads the risk matrix, the config and the rule scripts from the base branch; changes to them are high risk |
| Agents do not merge, approve, force-push, push to the default branch, set labels or write commit statuses (except `review-status.sh publish` after a saved review) | the PreToolUse hook `.claude/hooks/guard-bash.sh` and `permissions.deny` `Bash(...)` rules |
| A change passes every gate | `make check` locally, `quality-gates.yml` as required checks |
| Committed generated files match their source | the gate `drift` (`harness/scripts/drift.sh`) |
| Git hooks run on every commit | `.githooks/` through `make setup`; the guard hook denies `--no-verify` |
| The baseline holds unless an ADR replaces a rule | the architecture and code reviews name the rule number; a deviation without ADR is blocking (`harness/policies/adr.md`) |
| A project rule that a check enforces is not reviewed again | `(geprüft: <check>)` in `project-rules/`; `lint-ratchet.sh` for checks on old code |
| Every PR passes the rule check | `review-rules` check in `ai-review.yml`, the script from the base branch |
| Every PR has a review without blocking findings | the commit status `ai-review` of `/review`, required by the ruleset |
| Medium and high risk need a person | `human-gate` job in `auto-merge.yml` as a required check: label `human-approved` or an approving review |
| A check cannot be faked with a commit status of the same name | the ruleset pins every Actions check to the GitHub Actions app (`integration_id` 15368) |
| Control files need a human review | `.github/CODEOWNERS` |

Known gap: the guard hook matches patterns. A script, an interpreter or a call with the token of
`gh` can still reach the API or a protected file. The human gate checks who set the label;
CODEOWNERS and the branch ruleset are the second line. Report an agent that works around the
guard; it is a policy violation.

## The harness repository itself

The harness repository has no specs of its own, because `docs/` is the template for projects. A
decision record in `harness/decisions/` takes the place of the spec and the ADR; the rule check
accepts it. Its `.claude/settings.json` allows agents to edit the policies, `human-gate.sh`,
`auto-merge.yml` and the hooks, so the harness can be developed with agents; `AGENTS.md`,
`CLAUDE.md` and the settings stay denied. Every change to these files is high risk, so the label
of a person covers it. Sync the settings after a change to the template:

```bash
jq '.permissions.deny -= ["Edit(./harness/policies/**)", "Edit(./harness/scripts/human-gate.sh)",
  "Edit(./.github/workflows/auto-merge.yml)", "Edit(./.claude/hooks/**)"]' \
  harness/templates/settings.json > .claude/settings.json
```

## Language

Instructions for agents (this directory, `.claude/`, `.github/`) are written in simplified technical
English. Output for people (reports in the session, PR bodies, spec and ADR documents) uses the
language in `harness/config.yml` (`doc_language`).
