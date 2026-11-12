---
name: contract
description: Create or change a contract in contracts/ (API, event or schema definition) from the spec, check for breaking changes against the base branch, enforce the ADR policy for breaking changes and regenerate generated files with the project's target instead of editing them. Use when a change touches contracts/ or an API surface.
when_to_use: Load when a spec names a contract, when files under contracts/ or generated API types change, when git reports a conflict in a generated file, or when the user runs /contract.
argument-hint: <contract name or path> [--spec NNNN]
paths:
  - "contracts/**"
---

# Contract

Rules: `contracts/README.md`. Contracts are high risk (`harness/policies/risk.md`): every change
needs a spec with a `## Contracts` section and runs every AI review.

## 1. Read

- The spec: `## Contracts` names the files, the consumers and whether the change is compatible.
  No spec or no section: stop and report; `/spec` first.
- `contracts/README.md`, the existing contract file, `contracts_generate_target` in
  `harness/config.yml`.

## 2. Breaking-change check

Compare the contract with the base branch (`git diff origin/<default_branch>... -- contracts/`
after the edit, or the planned change before it). Breaking: a removed or renamed field, endpoint,
event or type; a type change; a new required field; a changed status code or error shape; a
removed enum value. Compatible: a new optional field, a new endpoint or event, a new enum value
when consumers tolerate unknown values.

Breaking and `adrs` in the spec is empty: stop and report that `harness/policies/adr.md` requires
an ADR with the migration path for every consumer. `/adr` writes it.

## 3. Change

1. Edit the source of the contract only. A generated file is never edited by hand; its header
   names the source and the generator.
2. `contracts_generate_target` set: run `make <target>` and stage the generated files with the
   source. One commit for both sides. Not set, and the contract has generated files: add the
   generator target to the `Makefile` and set the key in `harness/config.yml` in the same change.
   Both files belong in `## Umsetzung` of the spec; the config change makes the PR high risk.
3. Versioning as in `contracts/README.md`: compatible keeps the version, breaking bumps it and
   keeps the old version until every consumer named in the spec has moved.
4. Tests: the contract's own validation (schema lint, compile of generated types) runs in
   `make typecheck` or `make test`. Run the one that applies, then `make drift`.

## 4. Finish

Summary: files changed, compatible or breaking, consumers from the spec, ADR number when
breaking, generator run or not. Failing checks with output. No other text.
