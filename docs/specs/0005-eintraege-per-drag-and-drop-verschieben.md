---
id: "0005"
title: Einträge per Drag and Drop verschieben, auch zwischen Listen
status: in Arbeit
risk: high
adrs: ["0006"]
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: "#8"
note: "Rückmeldung zur Anzeige beim Ziehen umgesetzt"
---

# Einträge per Drag and Drop verschieben, auch zwischen Listen

## Ziel

Welle 4 der Roadmap. Die Person ordnet Einträge innerhalb einer Liste neu und zieht einen
Eintrag in eine andere Liste, mit Maus, Touch und Tastatur. Die neue Reihenfolge bleibt nach
dem Neuladen erhalten. Gelöst ist es, wenn `PUT /api/lists/{listId}/entries/order` die
Reihenfolge in einer Transaktion setzt und `make e2e` das Ziehen mit Tastatur und Maus prüft.

## Scope

### Enthalten

- Contract: `PUT /api/lists/{listId}/entries/order` mit `{ "entryIds": [...] }` (ADR 0006).
- Backend: Query `MoveEntry`, Handler `ReorderEntries` in einer Transaktion, Integrationstests.
- Frontend: dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`); Griff je
  Eintrag; Sortieren in der Liste und Ablegen in einer anderen Liste, auch in einer leeren;
  Tastatur über den Griff (Leertaste nimmt auf, Pfeile bewegen, Leertaste legt ab, Escape
  bricht ab); deutsche Ansagen für Screenreader; optimistische Aktualisierung des Query-Cache.
- Mit gesetztem Filter `Nur offene Einträge` bleibt das Ziehen möglich; ausgeblendete Einträge
  behalten ihre Reihenfolge, der gezogene Eintrag landet vor seinem sichtbaren Nachfolger oder
  am Ende der Zielliste.
- End-to-End-Fluss `frontend/e2e/drag-entries.spec.ts`.

### Nicht enthalten

- Listen anordnen (0006).
- Mehrfachauswahl, Ziehen mehrerer Einträge, Rückgängig.
- Ziehen eines Eintrags auf einen Listentitel außerhalb des Eintragsbereichs.

## Begriffe

Aus `docs/domain/glossary.md`: Liste, Eintrag, Position.

| Begriff | Bedeutung hier |
|---|---|
| Reihenfolge | Die vollständige, geordnete Liste der Eintrag-Ids einer Liste; das Backend setzt daraus `position = Index + 1`. |
| Griff | Der Button je Eintrag, an dem die Person zieht (`data-testid="entry-handle"`), mit zugänglichem Namen `Eintrag verschieben`. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | `PUT /api/lists/{listId}/entries/order` mit allen Ids der Liste in neuer Reihenfolge antwortet 204; danach liefert `GET /api/entries` die Einträge der Liste in dieser Reihenfolge mit `position` 1 bis n und geändertem `updated_at`. | Test |
| A2 | Enthält `entryIds` eine Id aus einer anderen Liste, bekommt dieser Eintrag `listId` der Zielliste und die Position aus der Reihenfolge; die übrigen Einträge der Quellliste behalten ihre Reihenfolge. | Test |
| A3 | Eine unbekannte Id in `entryIds` oder ein unbekanntes `listId` antwortet 404 `NOT_FOUND`, und keine Position ändert sich; ein leeres `entryIds` oder doppelte Ids antworten 400 `VALIDATION_FAILED`. | Test |
| A4 | Jeder Eintrag hat einen Griff mit dem Namen `Eintrag verschieben`; mit der Tastatur (Fokus auf dem Griff, Leertaste, Pfeil nach unten, Leertaste) rückt ein Eintrag eine Stelle nach unten, die Reihenfolge bleibt nach dem Neuladen erhalten. | `make e2e` und Browser |
| A5 | Mit der Maus gezogen landet ein Eintrag in einer anderen Liste an der Stelle, an der er abgelegt wurde, auch in einer leeren Liste; nach dem Neuladen steht er dort. | `make e2e` und Browser |
| A6 | Während des Ziehens zeigt der Eintrag einen sichtbaren Zustand (Schatten oder Umriss aus den Tokens); Screenreader-Ansagen und der Griff-Text kommen aus `de.json`. Klick, Kontrollkästchen, Bearbeiten und Löschen arbeiten unverändert (Aktivierung erst nach 5 Pixel Bewegung). | `make e2e` und Browser |
| A7 | `make check` und `make drift` sind grün; `order.test.ts` prüft die Berechnung der Reihenfolge mit und ohne ausgeblendete Einträge. | `make check` |

## Contracts

`contracts/api/openapi.yaml`: ändern, abwärtskompatibel (neuer Pfad
`/api/lists/{listId}/entries/order` mit `put`, neues Schema `EntryOrder { entryIds: uuid[] }`,
`minItems: 1`, `maxItems: 500`; Version bleibt 1). Antworten 204, 400, 404, `default` `Problem`.
Konsument: das Frontend über `schema.d.ts`. Generator: `make generate`.

## Risiko

Stufe: high
Begründung: `contracts/api/openapi.yaml` (`contracts/**`) ist high; `frontend/package.json` und
`pnpm-lock.yaml` sind Manifeste (mindestens medium); keine Migration. Gates: `make check` in
CI; Reviews Code, Sicherheit, Architektur; `verified` durch `verify` (G3); das Label
`human-approved` merged (G2).
ADR nötig: ja, Bedingung 1 (high risk) und 4 (Alternativen für die Reihenfolge, Wirkung auf
Backend und Frontend): ADR 0006; dnd-kit ist mit ADR 0001 entschieden. Die Freigabe dieser
Spec nimmt ADR 0006 an.

## Umsetzung

Entscheidungen:

- Neue Abhängigkeiten `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (ADR 0001).
- Contract: eine neue Operation `PUT /api/lists/{listId}/entries/order` (ADR 0006).
- Backend: `ReorderEntries` in einer Transaktion (`pool.Begin`, `store.WithTx`), je Id ein
  `UPDATE ... RETURNING id`; eine fehlende Zeile oder ein Fremdschlüsselfehler rollt zurück
  und antwortet 404 (A3.3, A4.4).
- Frontend: `DndContext` und Sensoren im Feature `entries` (`EntriesDndProvider`), von
  `app/App.tsx` um `ListsPage` gelegt; jede `EntryList` ist ein Drop-Ziel mit
  `SortableContext`, jeder `EntryItem` sortierbar mit Griff. Die neue Reihenfolge berechnet
  `order.ts` (rein, getestet) aus dem Query-Cache; `useReorderEntries` schreibt sie optimistisch
  in den Cache und invalidiert nach der Antwort. Kein neues Feature `board`.
- `project-rules/frontend.md` nennt Kontexte je Feature für Einstellungen und Interaktion
  (Hinweis aus PR #6).

Dateien:

- `docs/roadmap.md`: ändern, Zeilen 0005 und 0006 ohne `board`, ADR-Tabelle
- `docs/adr/0006-reihenfolge-als-id-liste.md`: neu
- `docs/adr/README.md`: ändern, Zeile 0006
- `contracts/api/openapi.yaml`: ändern, Pfad `/api/lists/{listId}/entries/order`, Schema `EntryOrder`
- `backend/db/queries/entries.sql`: ändern, `MoveEntry`
- `backend/internal/store/entries.sql.go`: ändern, generiert (sqlc)
- `backend/internal/api/api.gen.go`: ändern, generiert (oapi-codegen)
- `backend/internal/entries/handler.go`: ändern, `ReorderEntries`, Feld `pool`
- `backend/internal/entries/handler_test.go`: ändern, Tests A1 bis A3
- `frontend/package.json`: ändern, dnd-kit
- `frontend/pnpm-lock.yaml`: ändern
- `frontend/src/api/schema.d.ts`: ändern, generiert (openapi-typescript)
- `frontend/src/features/entries/entriesApi.ts`: ändern, `useReorderEntries` mit optimistischem Cache
- `frontend/src/features/entries/order.ts`: neu, Berechnung der Reihenfolge nach einem Drop
- `frontend/src/features/entries/order.test.ts`: neu, Vitest, tabellengetrieben
- `frontend/src/features/entries/EntriesDndProvider.tsx`: neu, `DndContext`, Sensoren, Ansagen, `onDragEnd`
- `frontend/src/features/entries/EntryList.tsx`: ändern, Drop-Ziel und `SortableContext`
- `frontend/src/features/entries/EntryItem.tsx`: ändern, `useSortable`, Griff
- `frontend/src/features/entries/EntryList.module.css`: ändern, Griff, Zieh-Zustand, Drop-Ziel
- `frontend/src/features/entries/locales/de.json`: ändern, `handle`, `dnd.*` Ansagen
- `frontend/src/app/App.tsx`: ändern, `EntriesDndProvider`
- `frontend/e2e/drag-entries.spec.ts`: neu, Flüsse A4 bis A6
- `project-rules/frontend.md`: ändern, Kontexte je Feature, dnd-kit-Regel (Griff, Aktivierung, Ansagen)
- `project-rules/backend.md`: ändern, Muster Reihenfolge als Id-Liste
- `project-rules/testing.md`: ändern, Bereiche

Schritte:

1. Contract und Query, `make generate`; `ReorderEntries` mit Transaktion und Tests.
2. `pnpm add` dnd-kit; `order.ts` mit Tests; `useReorderEntries`.
3. `EntriesDndProvider.tsx`, `EntryList.tsx`, `EntryItem.tsx`, Stile, `de.json`, `App.tsx`.
4. `drag-entries.spec.ts`; Projektregeln.
5. `make check`, `make e2e`, PR, `review`, `verify`.

Testdaten: `make seed STATE=with-entries` im `test.beforeAll` der End-to-End-Datei und für den
Browser-Gang; `make seed STATE=empty` im Global Setup.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `backend/internal/entries/handler_test.go`: `reorders the entries of a list` |
| A2 | `backend/internal/entries/handler_test.go`: `moves an entry into another list at the given index` |
| A3 | `backend/internal/entries/handler_test.go`: `answers 404 for an unknown entry id and changes nothing`, `answers 404 for an unknown list`, `rejects an empty or duplicate order` |
| A4 | `frontend/e2e/drag-entries.spec.ts`: `moves an entry down with the keyboard and keeps the order after reload` / Browser: Seite `Listen` |
| A5 | `frontend/e2e/drag-entries.spec.ts`: `drags an entry into another list with the mouse`, `drags an entry into an empty list` / Browser: Seite `Listen` |
| A6 | `frontend/e2e/drag-entries.spec.ts`: `keeps checkbox, edit and delete working with the handle present` / Browser: Zieh-Zustand |
| A7 | `make check`; `frontend/src/features/entries/order.test.ts` |

## Offene Fragen

- [x] Soll das Ziehen auch mit gesetztem Filter `Nur offene Einträge` möglich sein? → Ja;
      ausgeblendete Einträge behalten ihre Reihenfolge, der gezogene Eintrag landet vor seinem
      sichtbaren Nachfolger oder am Ende. (Morten Möller, 2026-11-13)

## Verifikationsplan

- make check
- betroffene Tests: `backend/internal/entries/`, `frontend/src/features/entries/order.test.ts`,
  `frontend/e2e/drag-entries.spec.ts` und `frontend/e2e/entries.spec.ts` über `make e2e`
- Browser: Seite `Listen` unter `http://localhost:5173` mit `make seed STATE=with-entries`
