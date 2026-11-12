# harness-test-3

<!-- One paragraph: what this system does and for whom. -->

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

<!-- Toolchain versions, install steps, local services. Keep it to what a new developer types. -->

```bash
make help
```

## Structure

```text
docs/            domain, specs, ADRs, architecture
contracts/       API, event and schema contracts
project-rules/   stack rules for frontend, backend, testing
src/             source code
harness/         workflow, policies, quality gates (harness-owned)
```

Harness version: see `HARNESS_VERSION`. Update with `harness/scripts/update.sh`.
