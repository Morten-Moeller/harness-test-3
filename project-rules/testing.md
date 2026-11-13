---
sources: [backend/internal/platform/testdb/**, backend/cmd/seed/**, frontend/playwright.config.ts, frontend/e2e/**, frontend/vite.config.ts]
---

# Testing rules

The general rules are in `harness/testing.md` (T1 to T7). This file names the tools and
commands of the project.

## Levels

| Level | Tool | Runs in | Scope (harness/testing.md T1) |
|---|---|---|---|
| unit | Go `testing` (table-driven), Vitest for `frontend/src/**/*.test.ts` | `make test` | pure calculations and mechanisms: config loading, problem details parsing |
| integration | Go `testing` with `net/http/httptest` against PostgreSQL in testcontainers-go (`postgres:17`) | `make test` | one feature through its HTTP routes; `backend/internal/platform/testdb` starts the container and applies the migrations |
| end-to-end | Playwright (`frontend/e2e/*.spec.ts`), Chromium | `make e2e`, locally only (`e2e_in_ci: false`) | user flows in the browser against backend and database |

## Additions

- Backend tests live next to the package (`handler_test.go`, package `<feature>_test`). One
  container per test package through `TestMain`; each test creates its own rows with unique
  titles and asserts only those (T3.1, T3.2).
- Frontend component flows are tested end-to-end, not with mocked API responses (T1.4).
- Docker is required for `make test`; without it the Go tests fail within seconds with the hint
  to start Docker (T4.3). testcontainers-go takes free ports, so two checkouts test at the same
  time (T3.6).
- Coverage floor: none.

## Areas

| Source path | Unit and integration | End-to-end |
|---|---|---|
| `backend/internal/lists/` | `backend/internal/lists/handler_test.go` | `frontend/e2e/lists.spec.ts` |
| `backend/internal/entries/` | `backend/internal/entries/handler_test.go` | `frontend/e2e/entries.spec.ts` |
| `backend/internal/platform/` | `backend/internal/platform/config/config_test.go`, `backend/internal/platform/validate/validate_test.go` | – |
| `frontend/src/api/` | `frontend/src/api/problem.test.ts` | – |
| `frontend/src/features/lists/` | – | `frontend/e2e/lists.spec.ts` |
| `frontend/src/features/entries/` | `frontend/src/features/entries/openOnly.test.ts`, `frontend/src/features/entries/order.test.ts` | `frontend/e2e/entries.spec.ts`, `frontend/e2e/open-only.spec.ts`, `frontend/e2e/drag-entries.spec.ts` |

## End-to-end

- Start: `make e2e` starts the database with `docker compose up -d --wait db`; Playwright's
  `webServer` starts the backend (`go run ./cmd/server` on `127.0.0.1:8090`) and Vite on
  `localhost:5173` and stops both afterwards. The application runs under
  `harness/scripts/app-lock.sh`.
- One spec: `cd frontend && pnpm exec playwright test e2e/lists.spec.ts`.
- Session setup (T6.2): none, there is no login.
- Environment check (T4.3): `frontend/e2e/global-setup.ts` runs `make seed-doctor` and fails
  with the fix from its JSON, then `make seed STATE=empty` (T6.3).
- Browsers: `pnpm exec playwright install chromium` once per machine (part of `make install`).

## Test data

- Command: `make seed STATE=<name>` runs `backend/cmd/seed`, applies pending migrations and
  prints one JSON document: `{"ok": true, "data": {...}}` or
  `{"ok": false, "error": {"code", "message", "fix"}}`.
- Environment check: `make seed-doctor`. Error codes: `CONFIG_MISSING` (set `DATABASE_URL`),
  `DB_UNREACHABLE` (`docker compose up -d --wait db`), `MIGRATION_FAILED`.
- Named states: `empty` (no lists, no entries), `with-lists` (the lists `Einkauf`, `Arbeit`,
  `Haushalt` without entries), `with-entries` (the same lists with three entries each, the
  first one done). The JSON lists every id.
- A spec file that needs lists runs `make seed STATE=with-lists` in `test.beforeAll` after the
  global setup emptied the data.
- Never write rows by hand, never call internal endpoints, never click through the application to
  make data that the command makes. A state the command lacks goes into a spec; the command is
  extended there.

## What `/verify` runs

- Automated: `make check`, `make e2e` and the tests of the touched areas (table Areas).
- Browser checks: `make dev` and `http://localhost:5173`, or `docker compose up --build` and
  `http://localhost:8080`; no login; test data with `make seed STATE=with-entries`.
