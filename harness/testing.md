# Testing baseline

Test rules that hold in every project of this harness. `project-rules/testing.md` names the tools,
commands, areas and the test data command of the project. A project replaces a rule with an ADR
that names the rule number in its line `Ersetzt Grundregeln:`; without such an ADR the rule holds
(decision 0017).

## T1 Levels

- T1.1 Behaviour is tested through the public interface: the HTTP route, the CLI command, the
  component as a user operates it. Not private methods.
- T1.2 Integration first: a feature test runs the real code path against the real database engine
  (a container); an in-memory substitute only where it behaves the same for the queries under test.
- T1.3 Unit tests for pure calculations and isolated mechanisms (rule engines, calculators,
  parsers), table-driven with one row per case. Code without logic of its own (forwarding,
  mapping, wiring) gets no unit test of its own.
- T1.4 Test doubles only for systems outside the repository: payment, mail, clock, external APIs.
  No mocks of own classes. A test that only checks a mock or a forwarded call is a finding.
- T1.5 End-to-end tests cover user flows across browser and backend, one flow per spec. They do not
  repeat what integration tests prove.

## T2 What a change tests

- T2.1 A change to behaviour comes with a test that fails without the change. A bug fix starts with
  the test that reproduces the bug.
- T2.2 Every acceptance criterion of the spec has its test (`## Umsetzung` names it).
- T2.3 An endpoint test covers every status and error code the contract names, the rows written on
  success and the rows not written on failure.

## T3 Data and isolation

- T3.1 A test creates the data it needs, with values unique per run (a random suffix, a new test
  user). No fixed ids, no dependence on test order or on data of other tests.
- T3.2 A test never counts or asserts rows it did not create. In a shared database it removes what
  it created, or it works only on data no other test reads.
- T3.3 A test that changes global state (settings, reference tables, feature switches) runs alone
  and restores the old value in a `finally` block or its equivalent.
- T3.4 Test data comes from builders or factories with defaults; the test states only the values it
  is about. No reflection into private state.
- T3.5 Data that is not under test comes from the test data command of the project (skill
  `test-data`), not from the user flow.
- T3.6 The test command takes free ports and its own data and build directories. Two runs in two
  checkouts on one machine at the same time pass (decision 0020: one worktree per spec of a wave).
  A fixed port belongs to the started application, which runs under
  `harness/scripts/app-lock.sh`, not to the tests. A project that cannot follow it records an ADR
  and sets `parallel_max: 1`.

## T4 Determinism

- T4.1 Time, random values and ids that a test checks come from sources the test controls (a clock,
  a seed).
- T4.2 No fixed sleeps. Wait for a visible state, a request or a condition, with a timeout.
- T4.3 A test that needs a service checks it first and fails within seconds with the fix, not after
  a timeout. A timeout of an asynchronous wait names what to inspect.
- T4.4 Flaky tests are fixed or deleted in their own PR, never retried in CI.

## T5 Form

- T5.1 A test is named after the behaviour, not the method: `marks an item as done`.
- T5.2 One behaviour per test; arrange, act and assert are visible.
- T5.3 Assertions check what the caller or the user sees: the response, the stored rows, the
  rendered text. Not internal calls.

## T6 End-to-end

- T6.1 Selectors: `data-testid` first, then role and accessible name. Never CSS classes of a
  component library, never a translated text alone.
- T6.2 Log in once per run in a setup step and reuse the stored session. Only tests of the login
  itself log in through the form.
- T6.3 Every run starts from the fresh data of its setup step; nothing to clean up between runs.
- T6.4 Screenshot comparisons render in a pinned container image, so fonts and browser match the
  baseline.

## T7 Gates

- T7.1 Never weaken a test or a check to make a change pass. A skipped test needs the line
  `Gate-Änderung: <Grund>` in the PR.
- T7.2 A coverage floor is optional. Lowering it is a gate change.
