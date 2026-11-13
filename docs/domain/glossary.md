# Glossar

Ein Begriff pro Zeile. "Nicht verwenden" nennt Synonyme, die im Code und in Specs nicht
vorkommen sollen.

| Begriff | Definition | Im Code | Nicht verwenden |
|---|---|---|---|
| Liste | Eine benannte Sammlung von Einträgen, die die Person anlegt, umbenennt, anordnet und löscht. | `list`, Tabelle `lists`, Feature `lists` | Board, Projekt, Kategorie |
| Eintrag | Eine Aufgabe in genau einer Liste, mit Titel und Status. | `entry`, Tabelle `entries` (ab Spec 0002) | Task, Item, Todo-Eintrag |
| offen | Status eines Eintrags, der noch nicht abgehakt ist. | `done = false` | aktiv, unerledigt |
| erledigt | Status eines Eintrags, den die Person abgehakt hat. | `done = true` | abgeschlossen, fertig |
| Position | Ganzzahl, die die Reihenfolge von Listen und von Einträgen in einer Liste bestimmt; Lücken erlaubt, aufsteigend sortiert. | `position` | Rang, Index, Order, Sortierung |
