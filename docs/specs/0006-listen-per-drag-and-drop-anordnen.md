---
id: "0006"
title: Listen per Drag and Drop anordnen
status: Review
risk: high
adrs: ["0006", "0007"]
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: ""
note: "freigegeben in der Session"
---

# Listen per Drag and Drop anordnen

## Ziel

Welle 5 der Roadmap, die letzte. Die Person ordnet die Listen auf der Seite `Listen` per Drag
and Drop, mit Maus, Touch und Tastatur. Das Ziehen von Einträgen aus 0005 funktioniert
unverändert weiter. Gelöst ist es, wenn `PUT /api/lists/order` die Reihenfolge in einer
Transaktion setzt, die beim Ziehen sichtbare Reihenfolge die gespeicherte ist und `make e2e`
beides prüft.

## Scope

### Enthalten

- Contract: `PUT /api/lists/order` mit `{ "listIds": [...] }` (ADR 0006).
- Backend: Query `MoveList`, Handler `ReorderLists` in einer Transaktion, Updates in fester
  Id-Reihenfolge; `inTransaction` aus `entries` zieht als `db.InTransaction` nach
  `backend/internal/platform/db/` und wird von beiden Features genutzt (Hinweis aus PR #8).
- Frontend: ein `DndContext` in `frontend/src/app/DndRoot.tsx` (ADR 0007); `EntriesDndProvider`
  wird zu einem Zieh-Modul des Features `entries`; neues Zieh-Modul im Feature `lists` mit Griff
  im Kopf jeder Liste, Platzhalter und mitlaufender Kopie wie bei Einträgen; deutsche Ansagen.
- End-to-End-Fluss `frontend/e2e/drag-lists.spec.ts`; die Flüsse aus `drag-entries.spec.ts`
  laufen unverändert.

### Nicht enthalten

- Listen nebeneinander (Spalten), horizontales Ziehen.
- Einträge auf einen Listenkopf ziehen.

## Begriffe

Aus `docs/domain/glossary.md`: Liste, Position.

| Begriff | Bedeutung hier |
|---|---|
| Reihenfolge der Listen | Die vollständige, geordnete Liste aller Listen-Ids; das Backend setzt `position = Index + 1`. |
| Griff | Button im Kopf jeder Liste (`data-testid="list-handle"`), zugänglicher Name `Liste verschieben`. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | `PUT /api/lists/order` mit allen Listen-Ids in neuer Reihenfolge antwortet 204; danach liefert `GET /api/lists` die Listen in dieser Reihenfolge mit `position` 1 bis n und geändertem `updated_at`. | Test |
| A2 | Eine unbekannte Id antwortet 404 `NOT_FOUND`, und keine Position ändert sich; ein leeres `listIds` oder doppelte Ids antworten 400 `VALIDATION_FAILED`. | Test |
| A3 | Jede Liste hat im Kopf einen Griff mit dem Namen `Liste verschieben`; mit der Tastatur (Fokus auf dem Griff, Leertaste, Pfeil nach unten, Leertaste) rückt eine Liste eine Stelle nach unten; die Reihenfolge bleibt nach dem Neuladen erhalten. | `make e2e` und Browser |
| A4 | Mit der Maus gezogen zeigt die Seite einen Platzhalter an der Zielstelle und eine Kopie des Listentitels am Zeiger; die beim Loslassen sichtbare Reihenfolge ist die gespeicherte, auch nach dem Neuladen. | `make e2e` und Browser |
| A5 | Das Ziehen von Einträgen innerhalb und zwischen Listen funktioniert wie in 0005; Umbenennen, Löschen und das Formular `Neuer Eintrag` arbeiten mit dem Griff unverändert. | `make e2e` |
| A7 | Enthält die Id-Liste nicht genau alle Listen (bei `PUT /api/lists/order`) oder nicht genau alle Einträge der Zielliste nach dem Verschieben (bei `PUT /api/lists/{listId}/entries/order`), rollt das Backend zurück und antwortet 409 `CONFLICT`; keine Position ändert sich. Das Frontend rollt auf den Stand vor dem Ziehen zurück, lädt neu und zeigt eine Meldung aus `de.json`. | Test und `make e2e` |
| A6 | Texte und Ansagen kommen aus `de.json`; `make check` und `make drift` sind grün; `order.test.ts` des Features `lists` prüft die Berechnung der Reihenfolge. | `make check` |

## Contracts

`contracts/api/openapi.yaml`: ändern, abwärtskompatibel (neuer Pfad `/api/lists/order` mit
`put`, neues Schema `ListOrder { listIds: uuid[] }`, `minItems: 1`, `maxItems: 500`; Version
bleibt 1). Antworten 204, 400, 404, 409, `default` `Problem`. Zusätzlich: neuer Wert `CONFLICT`
in `Problem.errorCode` und Antwort 409 an `PUT /api/lists/{listId}/entries/order`. Ein neuer
Enum-Wert ist kompatibel: der einzige Konsument (`frontend/src/api/problem.ts`) behandelt
unbekannte Werte als allgemeinen Fehler und bekommt den Wert in derselben Änderung. Konsument: das Frontend über
`schema.d.ts`. Generator: `make generate`.

## Risiko

Stufe: high
Begründung: `contracts/api/openapi.yaml` (`contracts/**`) ist high; keine Migration, keine neue
Abhängigkeit. Gates: `make check` in CI; Reviews Code, Sicherheit, Architektur; `verified`
durch `verify` (G3); das Label `human-approved` merged (G2).
ADR nötig: ja, Bedingung 1 (high) und 4 (ein Zieh-Kontext für beide Features): ADR 0007; die
Form der Reihenfolge deckt ADR 0006. Die Freigabe dieser Spec nimmt ADR 0007 an.

## Umsetzung

Entscheidungen:

- Contract: eine neue Operation `PUT /api/lists/order` (ADR 0006); `errorCode` `CONFLICT` und
  409 an beiden Reihenfolge-Operationen.
- Vollständigkeit: in der Transaktion nach den Updates `count(*)` des Containers gegen die Zahl
  der Ids; Abweichung rollt zurück und antwortet 409 (A3.2, A2.4). Gilt auch für `ReorderEntries`.
- `db.InTransaction` in `backend/internal/platform/db/` für `entries` und `lists` (A1.3).
- Ein `DndContext` in `app/DndRoot.tsx`; `entries` und `lists` liefern Zieh-Module über Hooks;
  `EntriesDndProvider` wird umgebaut (ADR 0007).
- Keine neuen Abhängigkeiten, keine Migration.

Dateien:

- `docs/roadmap.md`: ändern, Zeile 0006, ADR-Tabelle
- `docs/adr/0007-ein-zieh-kontext-fuer-die-seite.md`: neu
- `docs/adr/README.md`: ändern, Zeile 0007
- `contracts/api/openapi.yaml`: ändern, Pfad `/api/lists/order`, Schema `ListOrder`
- `backend/db/queries/lists.sql`: ändern, `MoveList`, `CountLists`
- `backend/internal/store/lists.sql.go`: ändern, generiert (sqlc)
- `backend/internal/api/api.gen.go`: ändern, generiert (oapi-codegen)
- `backend/internal/platform/db/transaction.go`: neu, `InTransaction`
- `backend/internal/entries/handler.go`: ändern, nutzt `db.InTransaction`, Prüfung auf Vollständigkeit (409)
- `backend/internal/entries/handler_test.go`: ändern, Test 409 bei unvollständiger Liste
- `backend/db/queries/entries.sql`: ändern, `CountEntriesOfList`
- `backend/internal/store/entries.sql.go`: ändern, generiert (sqlc)
- `backend/internal/platform/problem/problem.go`: ändern, `Conflict`
- `frontend/src/api/problem.ts`: ändern, `CONFLICT` in `errorCodes`
- `frontend/src/features/entries/entriesApi.ts`: ändern, bei 409 neu laden
- `frontend/src/features/entries/locales/de.json`: ändern, Meldung `errors.conflict`
- `backend/internal/lists/handler.go`: ändern, `ReorderLists`, Feld `pool`
- `backend/internal/lists/handler_test.go`: ändern, Tests A1 und A2
- `frontend/src/api/schema.d.ts`: ändern, generiert (openapi-typescript)
- `frontend/src/app/DndRoot.tsx`: neu, `DndContext`, Sensoren, Overlay, Ansagen, Weiche nach Typ
- `frontend/src/app/dndModule.ts`: neu, Typ `DndModule` (Schnittstelle der Zieh-Module)
- `frontend/src/app/App.tsx`: ändern, `DndRoot` und Vorschau-Provider
- `frontend/src/features/entries/EntriesDndProvider.tsx`: ändern, wird `useEntriesDnd` und `EntriesPreviewProvider`
- `frontend/src/features/entries/EntryList.tsx`: ändern, Import des Vorschau-Hooks
- `frontend/src/features/lists/listsApi.ts`: ändern, `useReorderLists` mit Rückrollen
- `frontend/src/features/lists/order.ts`: neu, Berechnung der Reihenfolge
- `frontend/src/features/lists/order.test.ts`: neu, Vitest
- `frontend/src/features/lists/ListsDnd.tsx`: neu, `useListsDnd`, `ListsPreviewProvider`, Overlay
- `frontend/src/features/lists/ListsPage.tsx`: ändern, `SortableContext` und Vorschau
- `frontend/src/features/lists/ListItem.tsx`: ändern, `useSortable`, Griff im Kopf
- `frontend/src/features/lists/ListsPage.module.css`: ändern, Griff, Zieh-Zustand, Overlay
- `frontend/src/features/lists/locales/de.json`: ändern, `handle`, `dnd.*`
- `frontend/e2e/drag-lists.spec.ts`: neu, Flüsse A3 und A4
- `project-rules/frontend.md`: ändern, Regel zum Zieh-Kontext in `app/`
- `project-rules/testing.md`: ändern, Bereiche

Schritte:

1. Contract und Query, `make generate`; `db.InTransaction`; `ReorderLists` mit Tests;
   `entries` auf `db.InTransaction`.
2. `dndModule.ts`, `DndRoot.tsx`; `EntriesDndProvider` auf ein Zieh-Modul umbauen; die Flüsse
   aus `drag-entries.spec.ts` müssen grün bleiben.
3. `lists`: `order.ts` mit Tests, `useReorderLists`, `ListsDnd.tsx`, `ListItem.tsx`,
   `ListsPage.tsx`, Stile, `de.json`; `App.tsx`.
4. `drag-lists.spec.ts`; Projektregeln.
5. `make check`, `make e2e`, PR, `review`, `verify`.

Testdaten: `make seed STATE=with-entries` im `test.beforeEach` der End-to-End-Datei und für den
Browser-Gang; `make seed STATE=empty` im Global Setup.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `backend/internal/lists/handler_test.go`: `reorders the lists` |
| A2 | `backend/internal/lists/handler_test.go`: `answers 404 for an unknown list id and changes nothing`, `rejects an empty or duplicate list order` |
| A3 | `frontend/e2e/drag-lists.spec.ts`: `moves a list down with the keyboard and keeps the order after reload` / Browser |
| A4 | `frontend/e2e/drag-lists.spec.ts`: `drags a list to the place shown while dragging` / Browser |
| A5 | `frontend/e2e/drag-entries.spec.ts` unverändert, `frontend/e2e/lists.spec.ts` |
| A6 | `make check`; `frontend/src/features/lists/order.test.ts` |
| A7 | `backend/internal/lists/handler_test.go`: `answers 409 for an incomplete list order and changes nothing`; `backend/internal/entries/handler_test.go`: `answers 409 for an incomplete entry order and changes nothing`; `frontend/src/api/problem.test.ts`: `CONFLICT` |

## Offene Fragen

- [x] Soll das Backend eine unvollständige Id-Liste ablehnen (409 `CONFLICT`, die Seite lädt
      neu), für Listen und für Einträge? → Ja, für beide; neuer Wert `CONFLICT` in `errorCode`.
      (Morten Möller, 2026-11-13)

## Verifikationsplan

- make check
- betroffene Tests: `backend/internal/lists/`, `backend/internal/entries/`,
  `frontend/src/features/lists/order.test.ts`, `frontend/e2e/drag-lists.spec.ts` und
  `frontend/e2e/drag-entries.spec.ts` über `make e2e`
- Browser: Seite `Listen` unter `http://localhost:5173` mit `make seed STATE=with-entries`
