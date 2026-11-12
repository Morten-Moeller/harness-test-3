---
name: test-data
description: Prepare test data for a manual check, a browser check, an end-to-end test or an API call with the project's test data command from project-rules/testing.md - check the environment, make the named state, read the JSON result. Never rows by hand.
when_to_use: Load before creating an account, a record or any other test data, before writing rows by hand or calling an internal endpoint to make data, when the test data command fails, or when a criterion needs data in a known state.
---

# Test data

Rules: section `## Test data` of `project-rules/testing.md`.

1. The section still says `TODO`: the project has no test data command. Make the data through the
   public interface of the application (its API or its screens) and name that in the summary.
   Never write rows into the database.
2. Run the environment check of the section. A failed check has a fix: apply it when it is a
   command in this repository; a fix for a person (a service outside this session, a credential)
   goes to the person with `AskUserQuestion`.
3. Run the command for the named state. Read the one JSON document: `ok` true, the result is in
   `data`; `ok` false, branch on `error.code`, not on the message text.
4. Use the IDs from the output. Do not predict IDs or numbers.
5. A state the command does not make: report it and stop. The extension of the command belongs in
   a spec; do not change the command on the side and do not make the data another way.
