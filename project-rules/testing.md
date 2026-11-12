---
sources: []
---

# Testing rules

<!-- TODO: fill at project start. The general rules are in harness/testing.md (T1 to T7); this
     file names the tools and commands of the project and its additions. A rule of
     harness/testing.md that does not fit is replaced by an ADR that names its number.
     sources: the globs of the test setup (for example playwright.config.ts, the test data tool). -->

## Levels

| Level | Tool | Runs in | Scope (harness/testing.md T1) |
|---|---|---|---|
| unit | TODO | `make test` | pure calculations, table-driven |
| integration | TODO | `make test` | one feature through its public interface, real database engine: TODO (container image) |
| end-to-end | TODO or none | `make e2e`, in CI only with `e2e_in_ci: true` | user flows in the browser |

## Additions

- File layout of tests: TODO (for example specs next to the file, backend tests mirror the package).
- Builders or factories: TODO.
- Coverage floor, if any: TODO.

## Areas

Which tests belong to which source paths. `implement` and `/verify` run the tests of the areas a
change touches.

| Source path | Unit and integration | End-to-end |
|---|---|---|
| TODO `src/orders/` | TODO `tests/orders/` | TODO `e2e/orders.spec.ts` |

## End-to-end

- Start: TODO. Either the tests start the application themselves (Playwright `webServer`, a
  compose file); then `e2e_in_ci: true` is possible. Or the application must run before
  (`make dev`); then `make e2e` runs locally only.
- One spec: TODO (for example `pnpm exec playwright test e2e/orders.spec.ts`).
- Session setup (T6.2): TODO (setup project and storage state file).
- Environment check (T4.3): TODO.

## Test data

- Command: TODO, for example `make seed STATE=<name>` or a project CLI. It needs no knowledge of
  tables and prints one JSON document per call (`ok`, `data`, `error.code`).
- Environment check: TODO (`make seed-doctor`): which services must run, with the fix for each.
- Named states: TODO (for example `empty`, `with-items`, `checked-out`).
- Never write rows by hand, never call internal endpoints, never click through the application to
  make data that the command makes. A state the command lacks goes into a spec; the command is
  extended there.

## What `/verify` runs

- Automated: `make check` and the tests of the touched areas (table Areas).
- Browser checks: which URL, which login, which test data state: TODO.
