---
name: domain
description: Maintain the domain language in docs/domain/ - add or sharpen glossary terms, record bounded contexts and invariants, and report where code or specs use words the glossary forbids. Use when a spec or a change needs a term that the glossary lacks, when the user runs /domain, or when a review finds a naming conflict.
when_to_use: Load when a spec, a review or the user names a domain term that is missing from or conflicts with docs/domain/glossary.md, or when the user runs /domain.
argument-hint: [<term> | check]
---

# Domain

`docs/domain/glossary.md` is the single list of terms. Code, specs and conversation use the terms
as written there. Language: `doc_language` in `harness/config.yml`.

## Add or sharpen a term (`/domain <term>`)

1. Read the glossary and grep `docs/` and the source paths of `harness/config.yml` for the term
   and its likely synonyms.
2. Write or update the row: term, one-sentence definition, where it lives in code (type, module,
   table), synonyms that are not to be used. Ask the person with `AskUserQuestion` when the
   definition is not clear from the spec or the code.
3. When the term belongs to a bounded context, add it to `docs/domain/contexts.md` (create the file
   from a table `| Kontext | Verantwortung | Begriffe | Spricht mit |` when it does not exist).
4. A rule that must always hold goes to `docs/domain/invariants.md` with the code location that
   enforces it, or `nicht durchgesetzt` when none does.

## Check (`/domain check`)

1. For every row, grep the source paths for the words in "Nicht verwenden".
2. For every type or module named in "Im Code", confirm it exists.
3. Report a table: term, finding (forbidden synonym at `file:line`, missing code location, term in
   code but not in the glossary). Do not rename anything in code; renaming is a change with its own
   spec.

## Finish

Do not commit. Summary: rows added or changed, conflicts found with `file:line`, open definitions
the person has to give.
