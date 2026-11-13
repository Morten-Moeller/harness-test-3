# 0007: Ein Zieh-Kontext für die Seite in app/, Features liefern ihre Zieh-Logik

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0006-listen-per-drag-and-drop-anordnen.md
Ersetzt Grundregeln: keine

## Kontext

Spec 0005 hat einen `DndContext` im Feature `entries` (`EntriesDndProvider`), der die ganze
Seite `Listen` umschließt. Spec 0006 macht auch Listen ziehbar. dnd-kit bindet jedes
`useSortable` und `useDroppable` an den nächsten umgebenden `DndContext`. Die Einträge liegen
innerhalb der Listen; ein zweiter Kontext für Listen würde die Einträge an sich binden, ein
Kontext innerhalb der Listen erreicht die Listen nicht. Features importieren einander nicht
(A1.6, `project-rules/frontend.md`).

## Optionen

### Option A: Ein `DndContext` in `app/`, jedes Feature liefert ein Zieh-Modul

- Vorteile: ein Kontext, Sensoren und Overlay an einer Stelle; `app/` verbindet die Features,
  wie schon `renderList`; jedes Feature behält seine Logik (Vorschau, Ziel, Reihenfolge) und
  seine Tests; die Weiche nach `active.data.current.type` (`entry`, `list`) ist klein.
- Nachteile: eine Schnittstelle für Zieh-Module (`onDragStart`, `onDragOver`, `onDragEnd`,
  `onDragCancel`, Kollision, Overlay, Ansagen) muss definiert werden; `EntriesDndProvider` wird
  umgebaut.

### Option B: Ein Feature `board`, das Listen und Einträge zusammen zieht

- Vorteile: alle Zieh-Logik an einer Stelle.
- Nachteile: `board` müsste die Caches und Typen beider Features kennen und importiert sie;
  Verstoß gegen A1.6 oder ein neues gemeinsames Modul mit Fachbegriffen.

### Option C: Zwei verschachtelte Kontexte mit getrennten Zieh-Griffen

- Vorteile: kein Umbau von 0005.
- Nachteile: funktioniert mit dnd-kit nicht (nächster Kontext gewinnt, siehe Kontext).

## Entscheidung

Option A. `frontend/src/app/DndRoot.tsx` hält den einzigen `DndContext`, die Sensoren
(Zeiger 5 px, Tastatur), das `DragOverlay` und die Ansagen. Jedes Feature exportiert einen
Hook, der ein Zieh-Modul mit dem Typ (`entry`, `list`) und den Ereignis-Funktionen liefert
(`useEntriesDnd`, `useListsDnd`), dazu seinen Vorschau-Provider. `DndRoot` leitet jedes
Ereignis an das Modul des aktiven Typs weiter. Kein Feature importiert ein anderes.

## Folgen

- `EntriesDndProvider` wird zu `useEntriesDnd` und `EntriesPreviewProvider`; das Verhalten aus
  0005 bleibt, die Tests aus 0005 laufen unverändert.
- `project-rules/frontend.md`: "Ein `DndContext` in `app/DndRoot.tsx`; Features liefern
  Zieh-Module."
- Ein weiterer ziehbarer Typ ergänzt nur ein Modul und einen Eintrag in `DndRoot`.
