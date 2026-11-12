---
name: spec
description: Write the spec for one change into docs/specs/NNNN-<slug>.md from the template, with testable acceptance criteria, the implementation plan, a risk proposal and the ADR check, ask the open questions together with the approval, and on approval commit it on the feature branch and continue with implement. Only on explicit request (/spec <topic>).
when_to_use: Load when the user runs /spec or names a change that has no spec yet and wants one written. Do not start it on your own.
argument-hint: <topic or one sentence>
disable-model-invocation: true
---

# Spec

Stage 1 of `harness/workflow.md`. Output: one spec with its plan, approved by the person in this
session (gates G0 and G1), committed on the feature branch. With "Freigeben und umsetzen" the
skill continues with `implement`.

## 1. Read

- `harness/workflow.md` (stage 1), `harness/policies/risk.md`, `harness/policies/adr.md`.
- `docs/domain/glossary.md`, `docs/architecture/overview.md`, `harness/architecture.md`,
  `harness/testing.md`, the `project-rules/*.md` of the areas the change touches.
- `harness/scripts/specs.sh` (the state of every spec), `docs/roadmap.md` when it exists, and
  the specs that share words with the topic (`grep -ril`). A spec that already covers the topic:
  report it and stop. A topic that is a whole project or needs several specs: suggest `/roadmap`.
- `doc_language` in `harness/config.yml`. The document is written in that language; the template
  headings are German and are translated when the language differs.
- The code the change touches, enough to plan files and tests.

## 2. Ask

Before writing, ask the person with `AskUserQuestion`, at most four questions in one call:
who the change is for and what they can do afterwards, what is out of scope, which screens or
endpoints change, which contracts or other systems are touched, which constraints hold (deadline,
compatibility, data). Skip a question when the argument or the code answers it. Questions left
open go to `## Offene Fragen`; the skill does not guess.

## 3. Write

1. Number: the highest of `docs/specs/NNNN-*`, the spec table of `docs/roadmap.md` and the branch
   names `<type>/<NNNN>-*` (`git branch --list` and `git ls-remote --heads origin`), plus one;
   `0001` when there is none. A number the roadmap reserved for this topic is taken as it is. Slug:
   lower case ASCII, hyphens, at most 40 characters. Path `docs/specs/NNNN-<slug>.md`.
2. Copy `docs/specs/0000-template.md` and fill every section. Frontmatter `id`, `title`,
   `status: draft`, `risk`, `adrs: []`, `owner` (`git config user.name`), `created` and `updated`
   (today), `pr: ""`, `note: ""`.
3. Acceptance criteria: `A1..An`, each one checkable by a test, a call or a screen. A criterion
   that names a screen, a button or a text is checked in the browser by `/verify`; say which. No
   criterion of the form "works correctly".
4. Terms: use the glossary as written. A term that is missing goes to `## Begriffe` with a
   definition and a note "neu, mit /domain ins Glossar".
5. `## Umsetzung`: first the block `Entscheidungen:`, at most five lines or `keine`: new
   dependencies, contract and API changes, data model and migrations, new modules or services,
   deviations from a rule (with the ADR). Then the files to create or change, each as a full path
   from the repository root on its own line (no `...`, `*` or `a.ts|html`;
   `harness/scripts/wave-check.sh` compares them), the steps in order, one test per criterion
   (file and case; for a criterion that names a screen an end-to-end spec when
   `project-rules/testing.md` has that level, otherwise the screen for `/verify`), the test data
   states the tests need, contracts to regenerate.
6. Risk: write the files of `## Umsetzung` to a scratchpad file and run
   `harness/scripts/risk-level.sh --files-from <file> --format text`. Write the level, the reasons
   and the gates that apply (`harness/policies/human-approval.md`) into `## Risiko`.
7. ADR: walk the list in `harness/policies/adr.md`. A plan that deviates from a rule of
   `harness/architecture.md` or `harness/testing.md` needs an ADR that names the rule number.
   Write `ADR nötig: ja, <reason>` or `nein, weil <reason>`. When one is needed, write it now
   with the steps of `.claude/skills/adr/SKILL.md` (status `proposed`); the approval below
   accepts it.
8. Verification plan: `make check`, the test files or areas that the criteria map to
   (`project-rules/testing.md`), the screens for the browser walk or `keiner`.
9. No table to update: the front matter is the state of the spec (decision 0019).

## 4. Approve

Print a short summary: goal, criteria, the block `Entscheidungen` as written, the number of
planned files, risk level and gates, ADR. Then one
`AskUserQuestion` call with the open questions of `## Offene Fragen` (at most three) and, as the
last question, the approval:

- `Freigeben und umsetzen`: approve, then continue with `implement`.
- `Nur freigeben`: approve and stop.
- `Ändern`: the person names the change; edit the spec and ask again.

More than three open questions: ask them first, then the approval. An open question without an
answer blocks the approval; it stays in the spec and the skill stops.

On approval:

1. `git fetch -q origin`. Branch `<type>/<NNNN>-<slug>` from `origin/<default_branch>`
   (`harness/config.yml`): `git switch -c <branch> origin/<default_branch>`. `<type>` is `feat`,
   `fix`, `refactor`, `docs` or `chore`. The new files move with the switch.
2. Frontmatter: `status: approved`, `updated` today, `note: freigegeben in der Session`. An
   answered question stays under `## Offene Fragen` as
   `- [x] <Frage> → <Antwort> (<Wer>, <Datum>)`.
3. An ADR written in step 3: `Status: accepted` and the row in `docs/adr/README.md`.
4. Commit the spec and the ADR: `docs(specs): <NNNN> freigegeben`, body
   `Freigabe in der Session durch <git user.name>, <date>.` and the attribution line from the
   session.
5. `Freigeben und umsetzen`: start the skill `implement` with `<NNNN>`.

Summary for `Nur freigeben`: path, branch, risk level, and that `/implement <NNNN>` starts the
implementation.
