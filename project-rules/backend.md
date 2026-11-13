---
sources: [backend/**, contracts/api/openapi.yaml]
---

# Backend rules

## Stack

- Go (version in `backend/go.mod`), `net/http` with the standard mux, `log/slog`.
- Database PostgreSQL 17 through pgx; migrations with goose, queries with sqlc (ADR 0002).
- golangci-lint, sqlc and oapi-codegen run through `go run` with the versions pinned in the
  `Makefile`; no global install.

## Structure

- No layering: a feature package under `backend/internal/<feature>/` holds its handlers and
  calls the generated queries directly (A1.2; ADR 0001).
- Platform packages under `backend/internal/platform/` (`config`, `db`, `problem`,
  `requestlog`, `server`, `testdb`) hold no business term and import no feature (A1.6).
- Generated and never edited by hand: `backend/internal/api/` from the contract,
  `backend/internal/store/` from `backend/db/queries/*.sql` (`make generate`, gate `drift`).
- Entry points: `backend/cmd/server` (the API), `backend/cmd/seed` (test data).

## Data

- Migrations are high risk: one migration per change, with `-- +goose Down`, reviewed by a
  person. Files `backend/db/migrations/NNNNN_<name>.sql`. The server applies pending migrations
  at start (ADR 0002).
- Every table has `id uuid` (UUIDv7 from the application, A4.2), `created_at` and `updated_at`
  as `timestamptz` in UTC (A4.3).
- A change that depends on the current state is one statement with `RETURNING` and a checked
  row count (A4.4). One request is at most one transaction (A3.3).
- Personal data: none. The one person owns every row (ADR 0003).

## Errors, logging, configuration

- Error model: RFC 9457 problem details with `errorCode` from `backend/internal/platform/problem`
  (A2.3). Codes: `VALIDATION_FAILED` (400), `NOT_FOUND` (404), `INTERNAL` (500). Input checks
  that need no stored data run before the first query (A3.1).
- Logging: `log/slog` as JSON on stdout, one logger per request with `requestId`
  (`requestlog.From(ctx)`). Never log request bodies, secrets or personal data.
- Configuration: `DATABASE_URL`, `HTTP_ADDR`, `LOG_LEVEL` from the environment, read once in
  `config.Load` and validated at start; a missing value stops the start with its name (A6.1).
  No secret in the repository; the Compose credentials are local development values.

## APIs

- Contract first: every endpoint exists in `contracts/api/openapi.yaml` before the code; the
  handler implements the generated `api.ServerInterface`.
- Authentication and authorisation: none, one person without login (ADR 0003 replaces A5.1,
  A5.2 and A2.5).
