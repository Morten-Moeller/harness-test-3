---
name: risk
description: Compute and explain the risk level of a change with harness/scripts/risk-level.sh and the diff, raise it with a written reason when the diff shows what the paths do not, name the human gates that apply, and write the result as the ## Risiko block of the PR body. Only on explicit request (/risk [PR]) or from /implement.
when_to_use: Load when the user runs /risk, when /implement needs the risk block, or when a person asks which gates a change needs. Do not start it on your own.
argument-hint: [<PR number>]
disable-model-invocation: true
---

# Risk

Policy: `harness/policies/risk.md`. The script is the floor; this skill may raise, never lower.

## 1. Collect

- With a PR number: `gh pr view <n> --json files,additions,deletions,headRefOid,author` and
  `gh pr diff <n>` into scratchpad files. Run
  `harness/scripts/risk-level.sh --files-from <paths> --diff-from <diff> --format text`.
  Author `dependabot[bot]`: pass `--dependabot <update-type>` from the PR title or body.
- Without a PR: `harness/scripts/risk-level.sh --include-working-tree --format text`.

## 2. Read the diff

Raise by one step, with the reason, when the diff shows one of these and the paths did not:

- data is deleted, migrated or exported; personal data is read or written in a new place
- authentication, authorisation, session or token handling changes
- a new call to another system, a new queue, a new scheduled job
- concurrency, caching or retry behaviour changes
- configuration that differs between environments changes
- a check, a test, a gate or an ignore list is weakened
- money, prices, invoices or payouts are computed

Never lower the level. A level that looks too high is a change to `harness/risk-matrix.yml` by a
person.

## 3. Write

Language: `doc_language` in `harness/config.yml`. Block:

```text
## Risiko

Stufe: <low | medium | high> (Skript: <level>, <angehoben wegen ... | nicht angehoben>)
Dateien: <n>, geänderte Zeilen: <n>
Gates: <G0, G1 | G0, G1, G2 | G0, G1, G2, G3> (harness/policies/human-approval.md)
ADR: <nötig wegen ... | nicht nötig>
Begründung: <zwei bis drei Sätze>
```

- With a PR number: replace the section `## Risiko` of the PR body (`gh pr view <n> --json body`)
  and write it back with `gh pr edit <n> --body-file <file>`. No PR comment.
- From `/implement`: return the block for the PR body.

Labels are set by CI (`risk-label.yml`), never by this skill.

## 4. Finish

Summary: level, raised or not and why, the gates.
