# Project rules

Stack-specific rules that every change follows. They add to the baseline of the harness,
`harness/architecture.md` (A1 to A7) and `harness/testing.md` (T1 to T7), and do not repeat it.
`/implement` reads the file for the area it touches; `/review` checks against them. A rule that
cannot be followed, here or in the baseline, needs an ADR that names it (`harness/policies/adr.md`).

| File | Covers |
|---|---|
| `frontend.md` | UI code: framework, state, styling, i18n, accessibility |
| `backend.md` | services, data access, errors, logging, configuration |
| `testing.md` | test levels, areas, end-to-end tests, test data, what `make test` runs |

Keep each file short: rules, not tutorials. One rule per bullet, with the reason when it is not
obvious. Replace every `TODO` block at project start.

## Rules become checks

A rule that a review reports twice becomes a check in the gates: a linter rule with its own test,
an architecture test, a script that `make lint` runs. A check gives the same answer every time; a
review does not. Mark the rule `(geprüft: <check>)`, for example
`- No comments in code (geprüft: eslint no-warning-comments).`; the reviewer agents skip such
rules.

A new check on old code that does not pass yet: count the findings per rule and compare them with
`lint-baseline.txt` through `harness/scripts/lint-ratchet.sh` in `make lint`. The count may fall,
never rise; the baseline is a gate file, so raising it needs a reason in the PR and a person.

## Sources

Each file names in its front matter the code it describes: `sources: [src/app/**, angular.json]`.
When a pull request changes a source and not the file, the rule check reports `doku`: check
whether the rule still holds. The same works for any Markdown file, for example
`docs/architecture/overview.md` or a skill.

## Area skills

A skill with `paths:` loads by itself when an agent works on matching files. Put the knowledge of
an area there: where things are, the recipe for a change that recurs (a new endpoint, a new
screen), the commands. Skills of the project live next to the harness skills; `update.sh` keeps
them.

```markdown
---
name: orders-area
description: Layout, rules and the recipe for a new endpoint in the orders area.
when_to_use: Load before a change under src/orders/.
paths: "src/orders/**"
---

# Orders area

Rules: `project-rules/backend.md`. ...
```
