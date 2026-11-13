---
id: "0002"
title: Einträge anlegen, abhaken, bearbeiten und löschen
status: Review
risk: high
adrs: ["0005"]
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: ""
note: "freigegeben in der Session"
---

# Einträge anlegen, abhaken, bearbeiten und löschen

## Ziel

Welle 2 der Roadmap. Die Person legt in jeder Liste Einträge an, hakt sie ab, ändert ihren
Titel und löscht sie. Jede Liste auf der Seite `Listen` zeigt ihre Einträge mit Kontrollkästchen
und einem Formular `Neuer Eintrag`. Gelöst ist es, wenn ein abgehakter Eintrag nach dem Neuladen
abgehakt bleibt und `make e2e` den Fluss prüft.

## Scope

### Enthalten

- Tabelle `entries` mit Migration, Queries und generiertem Store (ADR 0005).
- Contract: `GET /api/entries`, `POST /api/lists/{listId}/entries`,
  `PATCH /api/entries/{entryId}`, `DELETE /api/entries/{entryId}`.
- Backend-Feature `entries` mit Integrationstests; gemeinsame Validierung und JSON-Helfer unter
  `platform`.
- Frontend-Feature `entries`: Einträge je Liste, Formular `Neuer Eintrag`, Kontrollkästchen,
  Bearbeiten im Platz, Löschen; `app/App.tsx` verbindet `lists` und `entries`.
- Testdaten-Zustand `with-entries`.
- End-to-End-Fluss `frontend/e2e/entries.spec.ts`.

### Nicht enthalten

- Filter `nur offene Einträge` (0003), Listen umbenennen und löschen (0004), Drag and Drop
  (0005, 0006).
- Rückfrage vor dem Löschen eines Eintrags: ein Klick löscht.
- Paging der Einträge (A2.6): für eine Person nicht nötig; die Konvention kommt mit dem ersten
  Endpunkt, der sie braucht.

## Begriffe

Aus `docs/domain/glossary.md`: Liste, Eintrag, offen, erledigt, Position.

| Begriff | Bedeutung hier |
|---|---|
| Eintrag | Zeile in `entries`, gehört zu genau einer Liste (`listId`), mit `title`, `done`, `position`. |
| erledigt | `done = true`, in der Oberfläche durchgestrichen und mit gesetztem Kontrollkästchen. |
| Position | `position` je Liste, `MAX + 1` beim Anlegen, sortiert aufsteigend. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | `GET /api/entries` antwortet 200 mit `{ "items": [...] }`; jeder Eintrag hat `id`, `listId`, `title`, `done`, `position`, `createdAt`, `updatedAt`; die Einträge einer Liste kommen in aufsteigender `position`. | Test |
| A2 | `POST /api/lists/{listId}/entries` mit `{ "title": "Milch" }` antwortet 201 mit `{ "id" }`; der Eintrag ist offen und hat die nächste `position` seiner Liste; ein unbekanntes `listId` antwortet 404 `NOT_FOUND`; ein leerer, nur aus Leerzeichen bestehender, über 200 Zeichen langer oder Steuerzeichen enthaltender Titel antwortet 400 `VALIDATION_FAILED`. | Test |
| A3 | `PATCH /api/entries/{entryId}` mit `{ "done": true }` setzt den Eintrag auf erledigt und antwortet 204; `{ "title": "Hafermilch" }` ändert den Titel; beide Felder zusammen gehen in einem Aufruf; `updated_at` ändert sich, `created_at` nicht; ein leerer Body ohne Feld antwortet 400; ein unbekanntes `entryId` antwortet 404. | Test |
| A4 | `DELETE /api/entries/{entryId}` antwortet 204 und entfernt die Zeile; ein zweiter Aufruf antwortet 404. | Test |
| A5 | Auf der Seite `Listen` zeigt jede Liste ihre Einträge; das Formular `Neuer Eintrag` legt einen Eintrag an, der ohne Neuladen erscheint; das Kontrollkästchen hakt ab und ein abgehakter Eintrag ist durchgestrichen und bleibt es nach dem Neuladen; der Button `Bearbeiten` öffnet ein Eingabefeld, `Speichern` übernimmt den Titel; der Button `Löschen` entfernt den Eintrag; jeder Text kommt aus `de.json`, Bedienelemente tragen `data-testid` und sind per Tastatur erreichbar. | `make e2e` und Browser |
| A6 | Die Migration legt `entries` mit Fremdschlüssel `list_id` (`ON DELETE CASCADE`) und Index `(list_id, position)` an; `make seed STATE=with-entries` legt drei Listen mit je drei Einträgen an, davon einer erledigt, und druckt die Ids als JSON. | Test und Aufruf |
| A7 | `make check` ist grün; `make drift` nach `make generate` grün. | `make check` |

## Contracts

`contracts/api/openapi.yaml`: ändern, abwärtskompatibel (nur neue Pfade und Schemata, Version
bleibt 1). Neue Schemata `Entry { id, listId, title, done, position, createdAt, updatedAt }`,
`EntryPage { items: Entry[] }`, `CreateEntry { title }`, `UpdateEntry { title?, done? }`. Neue
Pfade: `GET /api/entries` (200 `EntryPage`), `POST /api/lists/{listId}/entries` (201 `Created`,
400, 404 `Problem`), `PATCH /api/entries/{entryId}` (204, 400, 404), `DELETE /api/entries/{entryId}`
(204, 404); `default` `Problem` wie bisher. Konsument: das Frontend über `schema.d.ts`.
Generator: `make generate`.

## Risiko

Stufe: high
Begründung: `contracts/api/openapi.yaml` (`contracts/**`) und `backend/db/migrations/00002_entries.sql`
(`**/migrations/**`) sind high; die übrigen Dateien medium oder low. Gates: `make check` in CI;
Reviews Code, Sicherheit, Architektur; `verified` durch `verify` (G3); das Label
`human-approved` merged (G2).
ADR nötig: ja, Bedingung 1 (high risk) und 4 (Alternativen mit Wirkung auf Backend und
Frontend): ADR 0005. Die Freigabe dieser Spec nimmt es an.

## Umsetzung

Entscheidungen:

- Datenmodell: Tabelle `entries` mit `list_id` als Fremdschlüssel `ON DELETE CASCADE`, `done`,
  `position` je Liste (ADR 0005).
- Contract: vier neue Operationen, `GET /api/entries` liefert alle Einträge; Fremdschlüsselfehler
  beim Anlegen wird 404 (ADR 0005).
- Gemeinsamer Code aus `lists` nach `platform/validate` (Titelprüfung) und `platform/httpjson`
  (JSON lesen und schreiben); `cmd/server` setzt `lists.Handler` und `entries.Handler` zu einem
  `api.ServerInterface` zusammen (A1.3).
- Frontend: `app/App.tsx` reicht `entries` als Render-Funktion an `ListsPage`; kein Import
  zwischen Features. Keine neuen Abhängigkeiten.

Dateien:

- `docs/adr/0005-eintraege-als-eigene-tabelle.md`: neu
- `docs/adr/README.md`: ändern, Zeile 0005
- `docs/architecture/overview.md`: ändern, Feature `entries` in den Modulgrenzen
- `contracts/api/openapi.yaml`: ändern, Schemata und Pfade für Einträge
- `backend/db/migrations/00002_entries.sql`: neu, Up und Down
- `backend/db/queries/entries.sql`: neu, `ListEntries`, `CreateEntry`, `UpdateEntry`, `DeleteEntry`, `DeleteAllEntries`
- `backend/internal/store/entries.sql.go`: neu, generiert (sqlc)
- `backend/internal/store/models.go`: ändern, generiert (sqlc)
- `backend/internal/api/api.gen.go`: ändern, generiert (oapi-codegen)
- `backend/internal/platform/validate/validate.go`: neu, `Title` (trimmen, 1 bis 200 Zeichen, keine Steuerzeichen)
- `backend/internal/platform/validate/validate_test.go`: neu, tabellengetrieben
- `backend/internal/platform/httpjson/httpjson.go`: neu, `Decode` mit `MaxBytesReader`, `Write`
- `backend/internal/lists/handler.go`: ändern, nutzt `validate` und `httpjson`
- `backend/internal/entries/handler.go`: neu, `ListEntries`, `CreateEntry`, `UpdateEntry`, `DeleteEntry`
- `backend/internal/entries/handler_test.go`: neu, Integrationstests A1 bis A4, A6
- `backend/cmd/server/main.go`: ändern, zusammengesetzte Handler
- `backend/cmd/seed/main.go`: ändern, Zustand `with-entries`, `empty` leert auch `entries`
- `frontend/src/api/schema.d.ts`: ändern, generiert (openapi-typescript)
- `frontend/src/features/entries/entriesApi.ts`: neu, `useEntries`, `useCreateEntry`, `useUpdateEntry`, `useDeleteEntry` mit Invalidierung
- `frontend/src/features/entries/EntryList.tsx`: neu, Einträge einer Liste und Formular `Neuer Eintrag`
- `frontend/src/features/entries/EntryItem.tsx`: neu, Kontrollkästchen, Bearbeiten im Platz, Löschen
- `frontend/src/features/entries/EntryList.module.css`: neu, nur Tokens
- `frontend/src/features/entries/locales/de.json`: neu, Namespace `entries`
- `frontend/src/features/lists/ListsPage.tsx`: ändern, Prop `renderList`
- `frontend/src/app/App.tsx`: ändern, verbindet `ListsPage` und `EntryList`
- `frontend/e2e/entries.spec.ts`: neu, Fluss A5
- `project-rules/testing.md`: ändern, Bereich `entries`, Zustand `with-entries`

Schritte:

1. ADR 0005 liegt aus dieser Session vor. Contract erweitern, Migration und Queries schreiben,
   `make generate`.
2. `platform/validate` und `platform/httpjson` anlegen, `lists/handler.go` darauf umstellen.
3. Feature `entries` mit Handlern und Tests; `cmd/server` zusammensetzen; Seed-Zustand
   `with-entries`.
4. Frontend: `entriesApi.ts`, `EntryList.tsx`, `EntryItem.tsx`, Namespace `entries`;
   `ListsPage` mit `renderList`, `App.tsx` verbindet.
5. `entries.spec.ts`, `project-rules/testing.md`, `overview.md`.
6. `make check`, `make e2e`, PR, `review`, `verify`.

Testdaten: `make seed STATE=with-entries` für den Browser-Gang; `make seed STATE=empty` im
Global Setup der End-to-End-Tests.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `backend/internal/entries/handler_test.go`: `lists entries of a list in position order` |
| A2 | `backend/internal/entries/handler_test.go`: `creates an entry with the next position`, `answers 404 for an unknown list`, `rejects invalid titles`; `backend/internal/platform/validate/validate_test.go` |
| A3 | `backend/internal/entries/handler_test.go`: `marks an entry as done`, `changes the title`, `changes title and done at once`, `rejects a body without fields`, `answers 404 for an unknown entry` |
| A4 | `backend/internal/entries/handler_test.go`: `deletes an entry and answers 404 afterwards` |
| A5 | `frontend/e2e/entries.spec.ts`: `adds an entry, checks it off and keeps it after reload`, `edits and deletes an entry` / Browser: Seite `Listen` |
| A6 | `backend/internal/entries/handler_test.go`: `deleting a list removes its entries` (direkt über `store`), Aufruf `make seed STATE=with-entries` |
| A7 | `make check` |

## Offene Fragen

- [x] Soll ein erledigter Eintrag beim Bearbeiten des Titels erledigt bleiben? → Ja, `PATCH`
      ändert nur die gesendeten Felder. (Morten Möller, 2026-11-13)

## Verifikationsplan

- make check
- betroffene Tests: `backend/internal/entries/`, `backend/internal/platform/validate/`,
  `frontend/e2e/entries.spec.ts` über `make e2e`
- Browser: Seite `Listen` unter `http://localhost:5173` (`make dev`) mit
  `make seed STATE=with-entries`
