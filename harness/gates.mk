# Shared gate targets. Included by the project Makefile. Harness-owned; do not edit in a project.
# test, typecheck and lint are defined in the project Makefile (see harness/quality-gates.md).

.PHONY: check sast deps drift setup specs help

# A missing tool skips its gate on a developer machine and fails it in CI, where CI=true is set
# (decision 0011). Usage in a recipe: @if $(call have,<tool>,<gate>,<install hint>); then ...; fi
have = { command -v $(1) >/dev/null 2>&1 || { if [ -n "$$CI" ]; then echo "make $(2): $(1) not installed. $(3)" >&2; exit 1; fi; echo "make $(2): übersprungen, $(1) ist nicht installiert; CI prüft. $(3)"; false; }; }

check: test typecheck lint sast deps drift ## Run every quality gate

sast: ## Static application security testing (semgrep) and secret scan (gitleaks)
	@if $(call have,semgrep,sast,https://semgrep.dev/docs/getting-started/quickstart); then semgrep scan --config auto --error --quiet; fi
	@if $(call have,gitleaks,sast,https://github.com/gitleaks/gitleaks#installing); then gitleaks detect --no-banner --redact; fi

deps: ## Known vulnerabilities in dependencies (osv-scanner over the lock files)
	@if $(call have,osv-scanner,deps,https://google.github.io/osv-scanner/installation/); then \
	  out=$$(osv-scanner scan source --recursive . 2>&1); code=$$?; printf '%s\n' "$$out"; \
	  if [ $$code -eq 128 ] && printf '%s' "$$out" | grep -q 'No package sources found'; then echo "make deps: no lock files in the repository, nothing to scan"; exit 0; fi; \
	  exit $$code; \
	fi

drift: ## Generated files match their source (contracts_generate_target in harness/config.yml)
	@harness/scripts/drift.sh

setup: ## Use the git hooks in .githooks (once per clone; pre-commit runs make precommit when defined)
	git config core.hooksPath .githooks

specs: ## Overview of the specs from their front matter (--open: make specs ARGS=--open)
	@harness/scripts/specs.sh $(ARGS)

help: ## List every target
	@grep -hE '^[a-zA-Z0-9_:.-]+:.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  %-14s %s\n", $$1, $$2}'
