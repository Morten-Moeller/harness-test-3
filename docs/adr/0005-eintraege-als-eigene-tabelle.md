# 0005: Einträge als eigene Tabelle mit Listenbezug, ein Endpunkt für alle Einträge

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0002-eintraege-anlegen-abhaken-bearbeiten.md
Ersetzt Grundregeln: keine

## Kontext

Spec 0002 bringt Einträge in Listen. Spätere Specs verschieben Einträge zwischen Listen (0005)
und blenden erledigte aus (0003). Die Oberfläche zeigt alle Listen mit ihren Einträgen auf
einem Bildschirm. Zu entscheiden sind das Datenmodell und der Zuschnitt der Endpunkte.

## Optionen

### Option A: Tabelle `entries` mit `list_id` (Fremdschlüssel, `ON DELETE CASCADE`), ein Endpunkt `GET /api/entries` für alle Einträge, Kommandos je Eintrag

- Vorteile: eine Query für den ganzen Bildschirm, ein Query-Cache-Schlüssel, einfache
  Invalidierung (A7.2); das Verschieben zwischen Listen ist ein `UPDATE` von `list_id` und
  `position`; das Löschen einer Liste mit Einträgen (Roadmap-Antwort zu 0004) ist eine
  Transaktion über den Fremdschlüssel.
- Nachteile: der Endpunkt liefert alle Einträge; für eine Person mit wenigen Listen ohne
  Folgen, mit Paging-Konvention (A2.6) später zu ergänzen.

### Option B: Einträge je Liste unter `GET /api/lists/{listId}/entries`

- Vorteile: enger Zuschnitt je Liste.
- Nachteile: eine Query je Liste (N+1) für den Bildschirm; das Verschieben zwischen Listen
  invalidiert zwei Caches; mehr Endpunkte für dasselbe Ergebnis.

### Option C: Einträge als JSON-Spalte an der Liste

- Vorteile: eine Tabelle.
- Nachteile: Abhaken und Umsortieren schreiben das ganze Dokument; keine atomaren Änderungen
  je Eintrag (A4.4); keine Fremdschlüssel.

## Entscheidung

Option A. Tabelle `entries (id uuid, list_id uuid references lists on delete cascade, title
text, done boolean, position integer, created_at, updated_at)` mit Index `(list_id, position)`.
Endpunkte: `GET /api/entries` (alle, sortiert nach `position`, `created_at`),
`POST /api/lists/{listId}/entries` (201, 404 bei fehlender Liste), `PATCH /api/entries/{entryId}`
(`title` und `done` optional, 204, 404), `DELETE /api/entries/{entryId}` (204, 404). `position`
je Liste als `MAX + 1`. Das Frontend gruppiert die Einträge nach `listId`.

## Folgen

- Gemeinsame Validierung des Titels und das JSON-Lesen und -Schreiben wandern aus `lists` nach
  `backend/internal/platform/validate` und `backend/internal/platform/httpjson` (A1.3).
- `docs/architecture/overview.md` nennt `entries` als zweites Feature; die Paging-Konvention
  (A2.6) wird mit dem ersten Endpunkt festgelegt, der sie braucht.
- Spec 0004 löscht Liste und Einträge über den Fremdschlüssel in einer Transaktion.
