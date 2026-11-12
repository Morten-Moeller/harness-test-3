# AGENTS.md

> USER-OWNED CONTROL FILE.
> AGENTS MUST NOT CREATE OR MODIFY ANY AGENTS.md FILE (OR DERIVATIVES THEREOF, like
> CLAUDE.md).
> If these instructions need changing, tell the user what should change instead.

harness-test-3. This repository uses the AI Development Harness (`harness/README.md`). The
workflow, the gates and the policies in `harness/` apply to every change.

## Workflow

- Every change starts from a spec in `docs/specs/` with status `approved`. No spec, no code.
  Skill `/spec`. Details: `harness/workflow.md`.
- Risk level and human gates: `harness/policies/risk.md`, `harness/policies/human-approval.md`.
  The person approves the spec with its plan in the session. For medium and high risk the
  person's label on the pull request is the merge decision.
- After every push to a pull request branch, run the skill `review` for it.
- Architecture decisions go to `docs/adr/` when `harness/policies/adr.md` requires one.
  Skill `/adr`.
- Domain terms come from `docs/domain/glossary.md`. Use them as written; propose new ones with
  `/domain`, do not invent synonyms.
- Contracts in `contracts/` are the agreement with other systems. Changes follow
  `contracts/README.md` and the skill `/contract`.
- Baseline: `harness/architecture.md` (A1 to A7) and `harness/testing.md` (T1 to T7) hold in every
  change. A deviation needs an ADR that names the rule number.
- Stack rules: `project-rules/frontend.md`, `project-rules/backend.md`, `project-rules/testing.md`.
- Test data only through the command in `project-rules/testing.md` (skill `test-data`). Never
  write rows by hand.

## Hard constraints

- Do not silently invent workarounds for unresolved edge cases. Surface the edge case to the user.
- Never weaken a check, a test, a gate or a policy to make a change pass.
- Never hand-edit generated files. Regenerate them with the target named in
  `contracts/README.md`.
- Never merge, approve a pull request, force-push or set labels. A person does that.
- Never skip the git hooks (`--no-verify`).
- Agents MUST NOT write comments in code.
- MUST write in dead prose and simplified technical English in code and in conversation. No
  'carry', 'load-bearing' or other fancy words.
- MUST NOT use anthropomorphic language, for example, but not restricted to: 'complain', 'hold',
  'want', 'ask', 'know', 'decide', 'tell'. Violations of such kind are considered UNREADABLE.
- Documents for people (specs, ADRs, PR comments, reports) use the language in
  `harness/config.yml` (`doc_language`).
- Do not inform the user about succeeding tests or builds, just about failing ones.
- Keep summaries succinct and reduce it to what the user actually needs to act on.

## Verification

`make help` lists every target. Before a pull request: `make check` (test, typecheck, lint, sast,
deps, drift) and the end-to-end specs of the touched areas (`project-rules/testing.md`). A failing
gate is reported with its output and is never edited to pass.
