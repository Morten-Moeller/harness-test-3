---
name: adr
description: Write an architecture decision record into docs/adr/NNNN-<slug>.md (MADR), add its row to docs/adr/README.md and link it from the spec. Only on explicit request (/adr <title>), from /spec when the ADR policy requires one, or when /implement stops because one is missing.
when_to_use: Load when the user runs /adr, or when /implement or /review report that harness/policies/adr.md requires an ADR that does not exist.
argument-hint: <decision as a sentence> [--spec NNNN]
disable-model-invocation: true
---

# ADR

Policy: `harness/policies/adr.md`. Template: `docs/adr/0000-template.md`. Language: `doc_language`
in `harness/config.yml`; translate the template headings when it differs from German.

## 1. Read

- `docs/adr/README.md` and every ADR whose title shares words with the argument. A decision
  that is already recorded: report the ADR and stop.
- The spec (`--spec` or the one named in the conversation): its `## Contracts` and `## Risiko`.
- `project-rules/*.md` of the affected area and `docs/architecture/overview.md`.

## 2. Options

At least two options, each with advantages and disadvantages that are specific to this project
(cost, fit with the rules, migration effort, operability). "Do nothing" counts as an option when
it is possible. When the person has already stated the decision, write it down as the decision
and still list the options that were on the table; ask with `AskUserQuestion` when the options
are unclear.

## 3. Write

1. Number: highest `NNNN` in `docs/adr/` plus one, `0001` when there is none. Slug as in `/spec`.
2. Fill the template: `Status: proposed`, today's date, the spec path or `keine`.
3. `## Folgen` names what changes in `project-rules/` or in other ADRs. A superseded ADR gets
   `Status: superseded by NNNN` in its status line; that is the only edit to an accepted ADR.
4. Row in `docs/adr/README.md`: `| NNNN | <title> | proposed | <date> |`.
5. Spec frontmatter: add the number to `adrs: [...]`.

## 4. Finish

Do not commit. `accepted` is the person's decision: from `/spec`, its approval question accepts
the ADR together with the spec; otherwise the person accepts it in the session or in the PR.

Summary: path, the decision in one sentence, what it supersedes or changes, and that acceptance is
the person's step.
