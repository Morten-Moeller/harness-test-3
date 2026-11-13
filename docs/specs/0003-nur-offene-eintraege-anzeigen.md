---
id: "0003"
title: Nur offene Einträge anzeigen
status: done
risk: medium
adrs: []
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: "#6"
note: "alle Kriterien erfüllt"
---

# Nur offene Einträge anzeigen

## Ziel

Welle 3 der Roadmap. Die Person blendet mit einem Schalter über den Listen alle erledigten
Einträge aus und sieht nur, was offen ist. Die Einstellung bleibt im Browser erhalten. Gelöst
ist es, wenn der Schalter in jeder Liste wirkt, nach dem Neuladen gesetzt bleibt und `make e2e`
den Fluss prüft.

## Scope

### Enthalten

- Schalter `Nur offene Einträge` über den Listen, Einstellung im `localStorage` des Browsers.
- Filter in `EntryList`: mit gesetztem Schalter nur Einträge mit `done = false`; ohne offene
  Einträge der Text `Keine offenen Einträge.`.
- End-to-End-Fluss `frontend/e2e/open-only.spec.ts`.

### Nicht enthalten

- Ein Filterparameter der API: der Filter läuft im Browser über den vorhandenen Query-Cache;
  alle Einträge bleiben geladen.
- Speichern der Einstellung im Backend.
- Änderungen an Listen (0004) und Drag and Drop (0005, 0006).

## Begriffe

Aus `docs/domain/glossary.md`: Eintrag, offen, erledigt.

| Begriff | Bedeutung hier |
|---|---|
| offen | `done = false`; nur diese Einträge sind mit gesetztem Schalter sichtbar. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | Über den Listen steht ein Kontrollkästchen mit dem Text `Nur offene Einträge` (`data-testid="open-only"`), beim ersten Besuch nicht gesetzt; gesetzt verschwinden in jeder Liste die erledigten Einträge, abgewählt erscheinen sie wieder. | `make e2e` und Browser |
| A2 | Die Einstellung bleibt nach dem Neuladen erhalten (`localStorage`); ein blockierter oder leerer Speicher führt zum Standard `nicht gesetzt` ohne Fehler. | `make e2e`, Test |
| A3 | Eine Liste ohne offene Einträge zeigt mit gesetztem Schalter `Keine offenen Einträge.`; eine Liste ohne Einträge zeigt weiter `Keine Einträge.` | `make e2e` |
| A4 | Mit gesetztem Schalter verschwindet ein Eintrag, sobald die Person ihn abhakt; das Formular `Neuer Eintrag` und `Bearbeiten` arbeiten unverändert. | `make e2e` |
| A5 | Jeder Text kommt aus `de.json`; der Schalter ist per Tastatur erreichbar und hat einen zugänglichen Namen. `make check` ist grün. | `make check` |

## Contracts

Keine.

## Risiko

Stufe: medium
Begründung: Dateien unter `frontend/src/` (medium) und ein Test (low); kein Contract, keine
Migration. Gates: `make check` in CI; Reviews Code und Sicherheit; `verified` nicht nötig
(`verify_required_for: high`); das Label `human-approved` merged (G2).
ADR nötig: nein, weil keine Abhängigkeit, kein Contract, keine Regelabweichung; die Entscheidung
(Filter im Browser, Einstellung im `localStorage`) betrifft nur das Frontend.

## Umsetzung

Entscheidungen:

- Filter im Browser über den Query-Cache der Einträge; kein API-Parameter (die Konvention der
  Listen-Endpunkte bleibt).
- Einstellung als React-Kontext des Features `entries` (`OpenOnlyProvider`, `useOpenOnly`),
  gespeichert unter dem Schlüssel `todo.openOnly` im `localStorage`; Lesen und Schreiben in
  `try`/`catch`, Standard `false`.
- `app/App.tsx` setzt den Provider und den Schalter über die Seite; kein Import zwischen den
  Features `lists` und `entries`.
- Keine neuen Abhängigkeiten.

Dateien:

- `frontend/src/features/entries/openOnly.ts`: neu, Kontext, Provider, `useOpenOnly`, `localStorage`
- `frontend/src/features/entries/openOnly.test.ts`: neu, Vitest: Lesen, Schreiben, blockierter Speicher
- `frontend/src/features/entries/OpenOnlyToggle.tsx`: neu, Kontrollkästchen mit Text
- `frontend/src/features/entries/EntryList.tsx`: ändern, Filter und Text `Keine offenen Einträge.`
- `frontend/src/features/entries/EntryList.module.css`: ändern, Stil des Schalters
- `frontend/src/features/entries/locales/de.json`: ändern, `openOnly`, `emptyOpen`
- `frontend/src/app/App.tsx`: ändern, Provider und Schalter
- `frontend/e2e/open-only.spec.ts`: neu, Flüsse A1 bis A4
- `project-rules/testing.md`: ändern, Zeile Bereiche für `open-only.spec.ts`

Schritte:

1. `openOnly.ts` mit Kontext und Speicher, Vitest dazu.
2. `OpenOnlyToggle.tsx`, Filter in `EntryList.tsx`, Texte in `de.json`.
3. `App.tsx`: Provider und Schalter über `ListsPage`.
4. `open-only.spec.ts`, `project-rules/testing.md`.
5. `make check`, `make e2e`, PR, `review`.

Testdaten: `make seed STATE=with-entries` (jede Liste hat einen erledigten Eintrag) im
`test.beforeAll` der End-to-End-Datei; `make seed STATE=empty` im Global Setup.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `frontend/e2e/open-only.spec.ts`: `hides done entries in every list while the switch is set` / Browser: Seite `Listen` |
| A2 | `frontend/e2e/open-only.spec.ts`: `keeps the switch after reload`; `frontend/src/features/entries/openOnly.test.ts`: `reads false when storage is blocked`, `writes and reads the value` |
| A3 | `frontend/e2e/open-only.spec.ts`: `shows the open-empty text for a list whose entries are all done` |
| A4 | `frontend/e2e/open-only.spec.ts`: `removes an entry from view when it is checked off` |
| A5 | `make check` |

## Offene Fragen

Keine.

## Verifikationsplan

- make check
- betroffene Tests: `frontend/src/features/entries/openOnly.test.ts`, `frontend/e2e/open-only.spec.ts`
  und `frontend/e2e/entries.spec.ts` über `make e2e`
- Browser: Seite `Listen` unter `http://localhost:5173` mit `make seed STATE=with-entries`
