# 0006: Reihenfolge von Einträgen und Listen als vollständige Id-Liste je Container setzen

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0005-eintraege-per-drag-and-drop-verschieben.md
Ersetzt Grundregeln: keine

## Kontext

Specs 0005 und 0006 ordnen Einträge in einer Liste, verschieben Einträge zwischen Listen und
ordnen Listen per Drag and Drop. `position` ist eine Ganzzahl je Container (Liste oder
Gesamtheit der Listen) und entsteht beim Anlegen als `MAX + 1` ohne Sperre (Hinweis der
Reviews zu 0001 und 0002). Zu entscheiden ist, wie das Frontend eine neue Reihenfolge an das
Backend meldet und wie das Backend sie speichert (A2.4, A3.3, A4.4).

## Optionen

### Option A: Ein Kommando je Container mit der vollständigen, geordneten Id-Liste

- Vorteile: eine Anfrage, eine Transaktion, Positionen danach lückenlos `1..n`; ein Verschieben
  zwischen Listen ist derselbe Aufruf mit einer fremden Id in der Zielliste (`list_id` wird
  gesetzt); keine Lese-Änderungs-Speichern-Folge und keine Abhängigkeit von alten Positionen;
  dieselbe Form für Einträge (0005) und Listen (0006).
- Nachteile: der Client sendet alle Ids des Containers, auch die ausgeblendeten; die Quellliste
  behält eine Lücke, die beim nächsten Umsortieren verschwindet.

### Option B: Ein Kommando "verschiebe Id an Index" mit Nachrücken im Backend

- Vorteile: kleiner Body.
- Nachteile: das Backend liest und verschiebt Nachbarn in mehreren Statements; zwei gleichzeitige
  Aufrufe erzeugen leicht doppelte Positionen; die Semantik von Index gegenüber ausgeblendeten
  Einträgen ist unklar.

### Option C: Bruchzahlen oder Gleitkomma-Positionen (zwischen zwei Nachbarn einfügen)

- Vorteile: nur eine Zeile ändert sich.
- Nachteile: braucht regelmäßiges Neuverteilen; Gleitkomma widerspricht der Ganzzahl im Glossar;
  mehr Sonderfälle.

## Entscheidung

Option A. `PUT /api/lists/{listId}/entries/order` mit `{ "entryIds": [...] }` setzt für jede Id
`list_id = listId`, `position = Index + 1` und `updated_at` in einer Transaktion und antwortet
204; eine unbekannte Id oder Liste antwortet 404 und ändert nichts; eine leere Liste oder
doppelte Ids antworten 400. Spec 0006 nutzt dieselbe Form für Listen
(`PUT /api/lists/order` mit `{ "listIds": [...] }`). Das Frontend berechnet die neue
vollständige Reihenfolge des Zielcontainers aus dem Query-Cache, auch wenn ein Filter Einträge
ausblendet, und schreibt sie optimistisch in den Cache; nach der Antwort invalidiert es die
Queries (A7.2).

## Folgen

- Positionen bleiben Ganzzahlen; Lücken sind erlaubt und verschwinden beim Umsortieren.
- Der Hinweis zur Vergabe `MAX + 1` beim Anlegen bleibt bestehen; doppelte Positionen beim
  gleichzeitigen Anlegen werden mit dem nächsten Umsortieren bereinigt.
- `project-rules/backend.md` nennt das Muster "Reihenfolge als Id-Liste" für Container.
