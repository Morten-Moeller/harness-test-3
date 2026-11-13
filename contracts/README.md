# Contracts

A contract is an agreement with another system or another part of this system: an OpenAPI or
GraphQL schema, an event schema, a database schema, a JSON schema, a message format. Contracts
are high risk (`harness/policies/risk.md`): every change runs every AI review and waits for a
person.

## Layout

```text
contracts/
├── api/        OpenAPI, GraphQL, gRPC definitions
├── events/     event and message schemas
└── schemas/    shared JSON schemas and data formats
```

## Rules

- A contract change starts in the spec (`## Contracts`) and names the consumers.
- Breaking changes need an ADR (`harness/policies/adr.md`) and a migration path for every consumer.
- Generated contracts are never hand-edited. The target in `harness/config.yml`
  (`contracts_generate_target`) regenerates them; the generated files and their source change in
  one commit. `/contract` enforces this, and the gate `make drift` fails when a committed copy
  does not match its source (`harness/quality-gates.md`). After a merge or a rebase that touched
  a source, run the target instead of resolving a conflict in a generated file by hand.
- Mark generated paths in `.gitattributes` with `linguist-generated=true`, so GitHub folds them in
  the pull request view. Never `-diff`: the review reads the diff of every file.
- A contract file carries a header that names its source and its generator when it is generated.
- Versioning: additive changes keep the version, breaking changes bump it and keep the old
  version until every consumer has moved.

## Skill

`/contract <name>` creates or changes a contract: it reads the spec, checks for breaking changes
against the base branch, runs the generator and links the spec and the ADR.
