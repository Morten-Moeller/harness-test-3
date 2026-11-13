# harness-test-3

A todo application for one person: several lists with entries, entries are checked off and
moved by drag and drop, a switch shows only open entries. React in the browser, Go and
PostgreSQL behind it. Roadmap: `docs/roadmap.md`.

## Working in this repository

This repository uses the AI Development Harness. Start with `AGENTS.md` and `harness/README.md`.

| I want to | Do |
|---|---|
| propose a change | `/spec <topic>` in Claude Code, then a person approves the spec |
| implement an approved spec | `/implement <spec-id>` |
| record a decision | `/adr <title>` |
| check a pull request | `/review <PR>`, `/verify <PR>` |
| run every quality gate | `make check` |

## Setup

Go (version in `backend/go.mod`), Node (version in `frontend/.nvmrc`) with pnpm, Docker.

```bash
make setup      # git hooks, once per clone
make install    # go mod download, pnpm install, Playwright browser
make check      # test, typecheck, lint, sast, deps, drift
```

## Run

```bash
docker compose up --build   # database, backend and frontend; open http://localhost:8080 (APP_PORT=8090 docker compose up for another port)
make dev                    # database in Docker, backend and Vite as local processes; http://localhost:5173
make e2e                    # end-to-end tests against backend and database
make seed STATE=with-lists  # test data (project-rules/testing.md)
```

## Structure

```text
docs/            domain, specs, ADRs, architecture, roadmap
contracts/       API contract (OpenAPI); make generate writes both sides
project-rules/   stack rules for frontend, backend, testing
backend/         Go API: cmd/, internal/<feature>, internal/platform, db/
frontend/        React app: src/features/<feature>, src/app, src/api, e2e/
harness/         workflow, policies, quality gates (harness-owned)
```

Harness version: see `HARNESS_VERSION`. Update with `harness/scripts/update.sh`.
