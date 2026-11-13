# Specs

Eine Spec pro Änderung. Datei `NNNN-<slug>.md` aus `0000-template.md`, vierstellige Nummer,
nächste freie (`/spec` zählt auch die Roadmap und die Branches mit). Status und Gates:
`harness/workflow.md`. Mehrere Specs zu einem Gesamtziel: `/roadmap`, `docs/roadmap.md`.

Der Stand jeder Spec steht nur in ihrem Frontmatter: `status`, `pr`, `updated`, `note`. Skills
ändern nur das Frontmatter ihrer Spec. Die Übersicht: `make specs`
(`harness/scripts/specs.sh`, mit `--open` nur die offenen).

Status: `draft` → `approved` (Freigabe einer Person, in der Session über `/spec` oder
`/roadmap`, oder von Hand) → `in Arbeit` → `Review` → `done`. `done` schreibt `verify` (bei low
`implement`) vor dem Merge auf den PR-Branch; auf `main` steht es erst mit dem Merge. `blockiert`
wartet auf eine Entscheidung, `note` nennt sie.

Beantwortete offene Fragen bleiben in ihrer Spec unter `## Offene Fragen`, mit Antwort, Person und
Datum.
