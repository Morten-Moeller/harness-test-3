# Quality gates. The target names are the contract with CI (harness/quality-gates.md).
# test, typecheck and lint are filled here. sast, deps, drift, check, setup and help come from
# harness/gates.mk. e2e runs locally (project-rules/testing.md); e2e_in_ci is false.

include harness/gates.mk

.PHONY: test typecheck lint e2e generate install dev seed seed-doctor

DATABASE_URL ?= postgres://todo:todo@localhost:5432/todo?sslmode=disable
HTTP_ADDR ?= 127.0.0.1:8090
LOG_LEVEL ?= info
STATE ?= empty

SQLC := go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1
OAPI_CODEGEN := go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2
GOLANGCI_LINT := go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0

export DATABASE_URL HTTP_ADDR LOG_LEVEL

test: ## Unit and integration tests (Go with PostgreSQL in testcontainers, Vitest)
	cd backend && go test ./...
	cd frontend && pnpm exec vitest run

typecheck: ## Static type check (go vet, tsc)
	cd backend && go vet ./...
	cd frontend && pnpm exec tsc --noEmit

lint: ## Style and static rules (golangci-lint, eslint, i18n keys)
	cd backend && $(GOLANGCI_LINT) run ./...
	cd frontend && pnpm exec eslint .
	cd frontend && pnpm exec i18next-cli extract --ci

e2e: ## End-to-end tests of user flows against the running application (project-rules/testing.md)
	docker compose up -d --wait db
	cd frontend && pnpm exec playwright test

generate: ## Regenerate the files from contracts/api/openapi.yaml and backend/db (gate drift)
	cd backend && $(SQLC) generate
	cd backend && $(OAPI_CODEGEN) -config oapi-codegen.yaml ../contracts/api/openapi.yaml
	cd frontend && pnpm exec openapi-typescript ../contracts/api/openapi.yaml -o src/api/schema.d.ts

install: ## Install the dependencies of backend and frontend
	cd backend && go mod download
	cd frontend && pnpm install --frozen-lockfile
	cd frontend && pnpm exec playwright install chromium

dev: ## Start the database, the backend and Vite for development
	docker compose up -d --wait db
	cd backend && go run ./cmd/server & cd frontend && pnpm exec vite; kill %1

seed: ## Make the test data state STATE (empty, with-lists); prints one JSON document
	@cd backend && go run ./cmd/seed --state $(STATE)

seed-doctor: ## Check that the database is reachable and migrated; prints one JSON document
	@cd backend && go run ./cmd/seed --doctor
