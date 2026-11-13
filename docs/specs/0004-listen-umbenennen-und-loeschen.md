---
id: "0004"
title: Listen umbenennen und löschen
status: Review
risk: high
adrs: ["0005"]
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: ""
note: "freigegeben in der Session"
---

# Listen umbenennen und löschen

## Ziel

Welle 3 der Roadmap. Die Person ändert den Titel einer Liste im Platz und löscht eine Liste
nach einer Rückfrage mitsamt ihren Einträgen (Roadmap-Antwort vom 2026-11-13, ADR 0005).
Gelöst ist es, wenn beides über die API und auf der Seite `Listen` geht und `make e2e` den
Fluss prüft.

## Scope

### Enthalten

- Contract: `PATCH /api/lists/{listId}` mit `{ "title" }`, `DELETE /api/lists/{listId}`.
- Backend: Queries `UpdateList`, `DeleteList`, Handler im Feature `lists`, Integrationstests.
- Frontend: `ListItem.tsx` mit Button `Umbenennen` (Eingabefeld im Platz, `Speichern`,
  `Abbrechen`) und Button `Löschen` mit Rückfrage im Platz (`Liste mit allen Einträgen
  löschen?`, `Bestätigen`, `Abbrechen`); kein Browser-Dialog.
- End-to-End-Fälle in `frontend/e2e/lists.spec.ts`.

### Nicht enthalten

- Verschieben von Listen (0006), Archivieren, Wiederherstellen einer gelöschten Liste.
- Änderungen am Feature `entries` (0003 läuft in derselben Welle).

## Begriffe

Aus `docs/domain/glossary.md`: Liste, Eintrag.

| Begriff | Bedeutung hier |
|---|---|
| Liste löschen | Entfernt die Zeile in `lists`; die Einträge gehen über den Fremdschlüssel `ON DELETE CASCADE` in derselben Transaktion mit (ADR 0005). |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | `PATCH /api/lists/{listId}` mit `{ "title": "Wochenmarkt" }` antwortet 204, der Titel ist getrimmt gespeichert, `updated_at` ändert sich, `created_at` und `position` nicht; ein leerer, nur aus Leerzeichen bestehender, über 200 Zeichen langer oder Steuerzeichen enthaltender Titel antwortet 400 `VALIDATION_FAILED`; ein unbekanntes `listId` antwortet 404 `NOT_FOUND`. | Test |
| A2 | `DELETE /api/lists/{listId}` antwortet 204; die Liste und alle ihre Einträge sind weg, Einträge anderer Listen bleiben; ein zweiter Aufruf antwortet 404. | Test |
| A3 | Auf der Seite `Listen` öffnet `Umbenennen` ein Eingabefeld mit dem Titel und Fokus; `Speichern` oder Enter übernimmt den Titel ohne Neuladen; `Abbrechen` oder Escape verwirft; ein leerer Titel zeigt die Meldung aus `de.json`. | `make e2e` und Browser |
| A4 | `Löschen` zeigt die Rückfrage `Liste mit allen Einträgen löschen?` mit `Bestätigen` und `Abbrechen`; `Bestätigen` entfernt die Liste mit ihren Einträgen ohne Neuladen, `Abbrechen` lässt sie stehen; nach dem Neuladen ist die Liste weg. | `make e2e` und Browser |
| A5 | Jeder Text kommt aus `de.json`; die Buttons tragen `data-testid` und sind per Tastatur erreichbar. `make check` und `make drift` sind grün. | `make check` |

## Contracts

`contracts/api/openapi.yaml`: ändern, abwärtskompatibel (neuer Pfad `/api/lists/{listId}` mit
`patch` und `delete`, neues Schema `UpdateList { title }`; Version bleibt 1). Antworten:
`PATCH` 204, 400, 404; `DELETE` 204, 404; `default` `Problem`. Konsument: das Frontend über
`schema.d.ts`. Generator: `make generate`.

## Risiko

Stufe: high
Begründung: `contracts/api/openapi.yaml` (`contracts/**`) ist high; `DELETE` löscht Daten
(Liste und Einträge) nach Rückfrage; keine Migration. Gates: `make check` in CI; Reviews Code,
Sicherheit, Architektur; `verified` durch `verify` (G3); das Label `human-approved` merged (G2).
ADR nötig: ja, Bedingung 1 (high risk); gedeckt durch ADR 0005 (Fremdschlüssel mit
`ON DELETE CASCADE`, Kommandos je Ressource). Kein neues ADR.

## Umsetzung

Entscheidungen:

- Contract: zwei neue Operationen am vorhandenen Ressourcenpfad, kompatibel.
- Löschen in einem Statement `DELETE FROM lists WHERE id = $1 RETURNING id`; die Einträge
  gehen über die Kaskade mit (A4.4, ADR 0005); kein vorheriges Lesen.
- Nach dem Löschen einer Liste invalidiert das Frontend alle Queries (`invalidateQueries()`
  ohne Schlüssel), weil auch die Einträge betroffen sind; so bleibt `lists` ohne Import aus
  `entries`.
- Rückfrage im Platz statt `window.confirm`, damit Tastatur, Test und Browser-Automation
  ohne nativen Dialog auskommen.
- Keine neuen Abhängigkeiten, keine Migration.

Dateien:

- `contracts/api/openapi.yaml`: ändern, Pfad `/api/lists/{listId}` mit `patch` und `delete`, Schema `UpdateList`
- `backend/db/queries/lists.sql`: ändern, `UpdateList`, `DeleteList`
- `backend/internal/store/lists.sql.go`: ändern, generiert (sqlc)
- `backend/internal/api/api.gen.go`: ändern, generiert (oapi-codegen)
- `backend/internal/lists/handler.go`: ändern, `UpdateList`, `DeleteList`
- `backend/internal/lists/handler_test.go`: ändern, Tests A1 und A2
- `frontend/src/api/schema.d.ts`: ändern, generiert (openapi-typescript)
- `frontend/src/features/lists/listsApi.ts`: ändern, `useUpdateList`, `useDeleteList`
- `frontend/src/features/lists/errorKey.ts`: neu, Zuordnung `errorCode` zu Textschlüssel (aus `ListsPage.tsx` herausgelöst)
- `frontend/src/features/lists/ListItem.tsx`: neu, Titel, Umbenennen im Platz, Löschen mit Rückfrage
- `frontend/src/features/lists/ListsPage.tsx`: ändern, nutzt `ListItem` und `errorKey`
- `frontend/src/features/lists/ListsPage.module.css`: ändern, Stile für Buttons, Eingabefeld und Rückfrage
- `frontend/src/features/lists/locales/de.json`: ändern, `rename`, `save`, `cancel`, `delete`, `confirmDelete`, `confirm`, `editTitle`
- `frontend/e2e/lists.spec.ts`: ändern, Fälle A3 und A4

Schritte:

1. Contract erweitern, Queries schreiben, `make generate`.
2. Handler `UpdateList` und `DeleteList` mit Tests (A1, A2).
3. `listsApi.ts`, `errorKey.ts`, `ListItem.tsx`, `ListsPage.tsx`, Stile, `de.json`.
4. `lists.spec.ts` erweitern.
5. `make check`, `make e2e`, PR, `review`, `verify`.

Testdaten: `make seed STATE=with-entries` für den Browser-Gang und im `test.beforeAll` der
End-to-End-Datei (Listen mit Einträgen zum Löschen); `make seed STATE=empty` im Global Setup.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `backend/internal/lists/handler_test.go`: `renames a list and keeps position and created_at`, `rejects invalid list titles`, `answers 404 when renaming an unknown list` |
| A2 | `backend/internal/lists/handler_test.go`: `deletes a list with its entries and answers 404 afterwards` |
| A3 | `frontend/e2e/lists.spec.ts`: `renames a list`, `shows the validation message for an empty list title` / Browser: Seite `Listen` |
| A4 | `frontend/e2e/lists.spec.ts`: `deletes a list with its entries after confirmation`, `keeps the list after cancel` / Browser: Seite `Listen` |
| A5 | `make check` |

## Offene Fragen

Keine.

## Verifikationsplan

- make check
- betroffene Tests: `backend/internal/lists/`, `frontend/e2e/lists.spec.ts` über `make e2e`
- Browser: Seite `Listen` unter `http://localhost:5173` mit `make seed STATE=with-entries`
