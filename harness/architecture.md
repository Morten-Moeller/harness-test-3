# Architecture baseline

Decisions that hold in every project of this harness, so a project does not start from zero. They
are stack-neutral; `project-rules/` adds the stack details. A project replaces a rule with an ADR in
`docs/adr/` that names the rule number in its line `Ersetzt Grundregeln:`; without such an ADR the
rule holds, and the architecture review reports a deviation as blocking (`harness/policies/adr.md`,
decision 0017).

A rule that a tool can check becomes a check (`project-rules/README.md`, decision 0014).

## A1 Structure

- A1.1 Code is grouped by feature (one business capability: its endpoints, its data access, its
  jobs), not by technical layer. A change then touches one place.
- A1.2 No speculative abstraction: no repository, service layer, mediator, interface or generic CRUD
  framework until a second real implementation or the framework needs it.
- A1.3 Code that is used once stays next to its caller. An operation that several features need
  moves to a shared module with one owner. Code that only looks reusable stays local.
- A1.4 State that a module owns is written only through that module. Other code calls it and never
  repeats its writes or their consequences.
- A1.5 A module name states its responsibility. Never `util`, `common`, `helpers`, `misc`.
- A1.6 Dependencies point one way: features use shared modules and platform code; platform code
  (technical infrastructure without business terms) uses no feature. Feature to feature goes
  through a shared operation in the same transaction, or a job for later work (A3.4).
- A1.7 One library per concern. A second library for the same concern needs an ADR.

## A2 API

- A2.1 The contract is in `contracts/` or generated from the code and committed. Clients use
  generated types, never hand-written copies (`contracts/README.md`, gate `drift`).
- A2.2 JSON field names in camelCase, enum values in UPPER_SNAKE_CASE, times in RFC 3339 with an
  offset, money as a decimal string or integer minor units, never as a binary float.
- A2.3 One error shape for the whole API: RFC 9457 problem details with a stable `errorCode`.
  Clients branch on `errorCode`, never on the message text.
- A2.4 A command answers 204, or 201 with the new id. 400 invalid input, 401 not authenticated,
  403 not allowed, 404 missing or not visible to the caller, 409 the resource is in another state.
- A2.5 A resource of another owner answers like a missing one (404). No response or diagnostic
  shows that it exists.
- A2.6 Every list endpoint uses the same convention for paging, sorting and filters.

## A3 Validation and transactions

- A3.1 Input checks that need no stored data (required, length, format, range, enum) run at the
  boundary, before the first database operation.
- A3.2 Checks that need stored state run inside the transaction or inside the atomic statement.
- A3.3 One request is at most one transaction. No external call and no slow I/O while it is open.
- A3.4 Work after the commit (mail, later processing, events to other systems) is written as a
  job or outbox row in the same transaction and runs after the commit. One such mechanism per
  project.
- A3.5 Data access code builds no HTTP errors; it returns typed results or errors, the boundary maps
  them.

## A4 Data

- A4.1 The schema changes only through versioned migrations in the repository.
- A4.2 The application creates the ids (UUIDv7: ordered by time, no round trip).
- A4.3 Every table has `created_at` and `updated_at` in UTC.
- A4.4 A change that depends on the current state is one atomic statement (`UPDATE ... WHERE id,
  owner and state ... RETURNING`), not read, change, save. The affected row count is checked. When
  no row matches, one error for every reason; no extra read to find the reason.
- A4.5 Queries select the columns the operation uses; no loading of whole object graphs.
- A4.6 Queries are parameterized. No SQL built from input strings.
- A4.7 With soft delete, a deleted row is terminal: every write and every selection of rows to
  write excludes it.
- A4.8 Business dates (deadlines, validity ranges, tax dates) come from one clock in the business
  time zone and are passed as parameters; no `now()` for them in a query.

## A5 Security

- A5.1 Roles and privileges come from the verified identity (token or session), never from request
  data that the client sets.
- A5.2 Ownership is checked in the same statement that reads or writes the resource.
- A5.3 Missing ownership data never counts as administrative access.
- A5.4 Secrets come from the environment or a secret manager. Never in the repository, never in a
  log, never in an error response.

## A6 Configuration and operation

- A6.1 Configuration comes from environment variables, is read in one place and validated at start.
  A missing value stops the start with its name.
- A6.2 One build for every environment. A frontend gets its runtime configuration at deploy time,
  not at build time.
- A6.3 No mutable global state and no code with side effects at import or package load.
- A6.4 Structured logs, one logger per request with a request id. No personal data and no secrets
  in logs.

## A7 Frontend

- A7.1 Server data lives in a query cache. Global client state holds only what the whole
  application needs (session, locale); everything else is local to its component.
- A7.2 A write invalidates the reads it changes. Nothing is reloaded by hand.
- A7.3 Every text for users goes through an i18n key. A check reports missing and unused keys.
- A7.4 Colors, spacing and type come from design tokens, never inline values.
- A7.5 Every interactive element works with the keyboard and has an accessible name; a linter checks
  it.
- A7.6 Elements that end-to-end tests drive carry a `data-testid`.
