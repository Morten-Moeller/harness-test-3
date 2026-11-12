---
sources: []
---

# Backend rules

<!-- TODO: fill at project start. Delete sections that do not apply. -->

## Stack

- Language, runtime and version: TODO
- Framework: TODO
- Database and migration tool: TODO

## Structure

- Layering (or the decision not to layer) and the ADR behind it: TODO
- Where a feature lives: TODO
- Dependency direction: TODO

## Data

- Migrations are high risk: one migration per change, reversible, reviewed by a person.
- Transactions and consistency rules: TODO
- Personal data: where it lives, how it is deleted: TODO

## Errors, logging, configuration

- Error model (exceptions, result types, error codes): TODO
- Logging library and what is never logged (secrets, personal data): TODO
- Configuration source and secret handling: TODO. No secret in the repository.

## APIs

- Contract first: every endpoint or event exists in `contracts/` before the code.
- Authentication and authorisation pattern: TODO
