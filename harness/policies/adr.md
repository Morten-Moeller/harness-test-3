# Policy: when an ADR is required

An architecture decision record (ADR) is a short document in `docs/adr/` that names a decision, the
options that were on the table and why one was chosen. It is written before the implementation and
linked from the spec and the PR.

## An ADR is required when one of these holds

1. The change is **high risk** (`risk.md`).
2. The change adds a **dependency, framework, runtime or infrastructure component** or bumps a
   framework by a major version.
3. The change **breaks a contract** in `contracts/`, or adds a contract that another system will
   depend on.
4. The decision has **alternatives** and its outcome affects **more than one module** or more than
   one team.
5. The change **deviates from a rule of `harness/architecture.md` or `harness/testing.md`**, from
   `project-rules/` or from an existing ADR. The new ADR names the rule numbers in its line
   `Ersetzt Grundregeln:`, supersedes the old ADR or records the exception.
6. A **reviewer** (`/review` or a person) asks for one.

## An ADR is not required when

- the decision is local to one module and has no alternative worth recording,
- the change only follows an existing ADR,
- the change is a dependency patch or minor update.

## Format and lifecycle

- Template: `docs/adr/0000-template.md` (MADR). File name `NNNN-<slug>.md`, four-digit number,
  next free number.
- Status: `proposed` when written, `accepted` when a person approves it in the PR that merges it,
  `superseded by NNNN` when a later ADR replaces it, `rejected` when it was not taken. ADRs are
  never deleted and never edited after acceptance except for the status line.
- Skill: `/adr <title>` writes the file from the template and adds a row to `docs/adr/README.md`.
- Language: `doc_language` from `harness/config.yml`.

## Enforcement

- `/implement` checks this policy after the risk assessment and stops when an ADR is required and
  missing.
- `harness/scripts/review-rules.sh` (rule `adr`) blocks a high-risk PR without a linked ADR;
  the architecture review of `/review` reports a missing ADR for the other conditions.
- The PR template has an `ADR` field. `none required` is a valid value with the reason behind it.
