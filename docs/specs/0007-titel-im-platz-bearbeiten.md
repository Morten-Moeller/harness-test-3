---
id: "0007"
title: Titel per Doppelklick oder Enter bearbeiten, Löschen als Icon in der Bearbeitung
status: approved
risk: medium
adrs: []
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: ""
note: "freigegeben in der Session"
---

# Titel per Doppelklick oder Enter bearbeiten, Löschen als Icon in der Bearbeitung

## Ziel

Die Person bearbeitet den Titel eines Eintrags oder einer Liste direkt im Platz: Doppelklick
auf den Titel oder Enter, wenn der Titel den Tastaturfokus hat. Die Buttons `Bearbeiten`,
`Umbenennen` und `Löschen` verschwinden aus der normalen Ansicht; Löschen ist ein Icon, das nur
während der Bearbeitung sichtbar ist. Gelöst ist es, wenn die Seite `Listen` ruhiger aussieht
und `make e2e` die neue Bedienung mit Maus und Tastatur prüft.

## Scope

### Enthalten

- Einträge: Titel als fokussierbares Element neben dem Kontrollkästchen; Doppelklick oder Enter
  öffnet das Eingabefeld; Enter speichert, Escape bricht ab, Verlassen des Felds speichert;
  Papierkorb-Icon `Eintrag löschen` nur in der Bearbeitung, ein Klick löscht sofort.
- Listen: gleiche Bedienung für den Listentitel; Papierkorb-Icon `Liste löschen` nur in der
  Bearbeitung, es öffnet die vorhandene Rückfrage `Liste mit allen Einträgen löschen?`.
- Gemeinsames Icon in einem neuen UI-Modul `frontend/src/ui/`.
- Anpassung der vorhandenen End-to-End-Tests an die neue Bedienung, neue Datei
  `frontend/e2e/inline-edit.spec.ts`.

### Nicht enthalten

- Änderungen an API, Contract oder Backend.
- Rückgängig nach dem Löschen eines Eintrags.
- Bearbeiten mehrerer Titel gleichzeitig.

## Begriffe

Aus `docs/domain/glossary.md`: Liste, Eintrag.

| Begriff | Bedeutung hier |
|---|---|
| Bearbeitung | Zustand, in dem statt des Titels ein Eingabefeld und das Lösch-Icon zu sehen sind. Höchstens ein Titel je Eintrag oder Liste. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | Ein Doppelklick auf den Titel eines Eintrags öffnet das Eingabefeld mit Fokus und markiertem Titel; ebenso Enter, wenn der Titel den Fokus hat. Der Doppelklick ändert den Status `erledigt` nicht. Neben dem Eintrag gibt es keinen Button `Bearbeiten` und keinen Button `Löschen` mehr. | `make e2e` und Browser |
| A2 | In der Bearbeitung eines Eintrags speichert Enter den Titel, Escape verwirft die Änderung, Verlassen des Felds (Klick daneben, Tab) speichert. Ein leerer oder ungültiger Titel zeigt die Meldung aus `de.json`, das Feld bleibt offen. Nach dem Speichern oder Abbrechen hat der Titel wieder den Fokus. | `make e2e` |
| A3 | Nur in der Bearbeitung eines Eintrags ist ein Papierkorb-Icon zu sehen, mit `title` und zugänglichem Namen `Eintrag löschen`. Ein Klick löscht den Eintrag sofort, ohne vorher den geänderten Titel zu speichern. | `make e2e` und Browser |
| A4 | Für Listen gilt A1 und A2 mit dem Listentitel; der Button `Umbenennen` entfällt. Das Icon `Liste löschen` ist nur in der Bearbeitung zu sehen und öffnet die Rückfrage `Liste mit allen Einträgen löschen?`; `Bestätigen` löscht, `Abbrechen` lässt die Liste stehen. | `make e2e` und Browser |
| A5 | Titel sind per Tab erreichbar und tragen den Namen `Eintrag bearbeiten: <Titel>` oder `Liste bearbeiten: <Titel>`. Ziehen, Kontrollkästchen und Filter arbeiten unverändert. Texte kommen aus `de.json`; `make check` ist grün. | `make check`, `make e2e` |

## Contracts

Keine.

## Risiko

Stufe: medium
Begründung: nur Dateien unter `frontend/src/` (medium), Tests und Doku (low); kein Contract,
keine Migration, keine Abhängigkeit. Gates: `make check` in CI; Reviews Code und Sicherheit;
`verified` nicht nötig (`verify_required_for: high`); das Label `human-approved` merged (G2).
ADR nötig: nein, weil keine Abhängigkeit, kein Contract, keine Abweichung von einer Regel; das
neue UI-Modul folgt A1.3 (Code, den zwei Features nutzen, in ein gemeinsames Modul mit einem
Besitzer).

## Umsetzung

Entscheidungen:

- Neues gemeinsames Modul `frontend/src/ui/` für Bedienelemente ohne Fachbegriffe (zuerst das
  Papierkorb-Icon als Inline-SVG); Features dürfen es importieren (A1.3, A1.6).
- Klick auf das Lösch-Icon verhindert das Speichern beim Verlassen des Felds
  (`onMouseDown` mit `preventDefault`, damit das Feld den Fokus behält).
- Keine neuen Abhängigkeiten, keine API-Änderung.

Dateien:

- `frontend/src/ui/TrashIcon.tsx`: neu, Inline-SVG, `aria-hidden`
- `frontend/src/features/entries/EntryItem.tsx`: ändern, Titel als Button, Bearbeitung mit Enter, Escape, Blur, Lösch-Icon
- `frontend/src/features/entries/EntryList.module.css`: ändern, Titel-Button, Icon-Button
- `frontend/src/features/entries/locales/de.json`: ändern, `editEntry`, `deleteEntry`; `edit`, `save`, `cancel`, `delete` entfallen
- `frontend/src/features/lists/ListItem.tsx`: ändern, Titel als Button, Bearbeitung, Lösch-Icon öffnet Rückfrage
- `frontend/src/features/lists/ListsPage.module.css`: ändern, Titel-Button, Icon-Button
- `frontend/src/features/lists/locales/de.json`: ändern, `editList`, `deleteList`; `rename`, `save` entfallen
- `frontend/e2e/inline-edit.spec.ts`: neu, Flüsse A1 bis A5
- `frontend/e2e/entries.spec.ts`: ändern, Bearbeiten und Löschen über die neue Bedienung
- `frontend/e2e/drag-entries.spec.ts`: ändern, Fall Kontrollkästchen, Bearbeiten, Löschen
- `frontend/e2e/open-only.spec.ts`: ändern, Bearbeiten über Doppelklick
- `frontend/e2e/lists.spec.ts`: ändern, Umbenennen und Löschen über die neue Bedienung
- `project-rules/frontend.md`: ändern, Modul `ui/`, Bearbeitung im Platz
- `project-rules/testing.md`: ändern, Bereiche
- `docs/architecture/overview.md`: ändern, Modul `ui/` in den Modulgrenzen

Schritte:

1. `TrashIcon.tsx`.
2. `EntryItem.tsx`: Titel-Button, Doppelklick und Enter, Eingabefeld mit Enter, Escape, Blur,
   Fokus zurück auf den Titel; Lösch-Icon; Stile und Texte.
3. `ListItem.tsx` entsprechend; Lösch-Icon öffnet die vorhandene Rückfrage.
4. End-to-End: `inline-edit.spec.ts`, vorhandene Specs anpassen.
5. Regeln und Übersicht; `make check`, `make e2e`, PR, `review`.

Testdaten: `make seed STATE=with-entries` im `test.beforeEach` von `inline-edit.spec.ts`;
`make seed STATE=empty` im Global Setup.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `frontend/e2e/inline-edit.spec.ts`: `opens the entry editor with a double click without checking it off`, `opens the entry editor with Enter on the title` |
| A2 | `frontend/e2e/inline-edit.spec.ts`: `saves with Enter`, `discards with Escape`, `saves when the field loses focus`, `keeps the field open for an empty title` |
| A3 | `frontend/e2e/inline-edit.spec.ts`: `shows the delete icon only while editing and deletes the entry` |
| A4 | `frontend/e2e/inline-edit.spec.ts`: `renames a list with a double click and Enter`, `deletes a list through the icon and the confirmation` |
| A5 | `make check`; `frontend/e2e/drag-entries.spec.ts`, `frontend/e2e/open-only.spec.ts`, `frontend/e2e/lists.spec.ts` |

## Offene Fragen

- [x] Wie wird die Bearbeitung beendet? → Enter speichert, Escape bricht ab, Klick daneben
      speichert. (Morten Möller, 2026-11-13)
- [x] Fällt der Button `Bearbeiten` weg? → Ja. (Morten Möller, 2026-11-13)
- [x] Löscht das Icon sofort? → Ja, ohne Rückfrage (Einträge). (Morten Möller, 2026-11-13)
- [x] Gilt das auch für Listen? → Ja; das Löschen einer Liste behält die Rückfrage.
      (Morten Möller, 2026-11-13)

## Verifikationsplan

- make check
- betroffene Tests: `frontend/e2e/` über `make e2e` (alle Specs, weil vier Dateien die
  Bedienung nutzen)
- Browser: Seite `Listen` unter `http://localhost:8080` mit `make seed STATE=with-entries`:
  Doppelklick, Enter, Escape, Lösch-Icon für Eintrag und Liste
