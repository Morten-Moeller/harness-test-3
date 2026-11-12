# Quality gates. The target names are the contract with CI (harness/quality-gates.md).
# Fill test, typecheck and lint. sast, deps, drift, check, setup and help come from harness/gates.mk.
# e2e is optional: it runs locally, and in CI with e2e_in_ci: true in harness/config.yml.
# precommit is optional: .githooks/pre-commit runs it on every commit when this file defines it.

include harness/gates.mk

.PHONY: test typecheck lint e2e

test: ## Unit and integration tests
	@echo "make test: not configured. Fill this target in Makefile. See harness/quality-gates.md."; exit 1

typecheck: ## Static type check
	@echo "make typecheck: not configured. Fill this target in Makefile. See harness/quality-gates.md."; exit 1

lint: ## Style and static rules
	@echo "make lint: not configured. Fill this target in Makefile. See harness/quality-gates.md."; exit 1

e2e: ## End-to-end tests of user flows (project-rules/testing.md)
	@echo "make e2e: no end-to-end tests configured. See project-rules/testing.md."
