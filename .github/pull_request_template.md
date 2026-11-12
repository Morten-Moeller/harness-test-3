<!-- Titel: <type>(<scope>): <Zusammenfassung> (<Spec-Nr>).
     Wird beim Squash-Merge zur Commit-Zeile. -->

## Spec

docs/specs/NNNN-<slug>.md

## Risiko

<!-- Block aus /risk: Stufe, Dateien, Gates, ADR, Begründung. -->

## ADR

<!-- docs/adr/NNNN-<slug>.md oder: keines nötig, weil <Bedingung aus harness/policies/adr.md
     trifft nicht zu>. -->

## Akzeptanzkriterien

<!-- Der Plan steht in der Spec (## Umsetzung) und ist mit ihr freigegeben. /verify ergänzt die
     Spalte Ergebnis und die Zeile Geprüft. -->

| Kriterium | Nachweis | Ergebnis |
|---|---|---|
| A1 | Test `<pfad>` / `/verify` im Browser | offen |

## Gate-Änderung

<!-- Nur wenn der PR eine Prüfung abschaltet oder eine Gate-Datei ändert, eine Zeile
     "Gate-Änderung: <Grund>" am Zeilenanfang. Sonst den Abschnitt löschen. -->

## Checks

- [ ] `make check` grün
- [ ] Contracts regeneriert, nicht von Hand geändert
- [ ] Keine Prüfung, kein Test, kein Gate aufgeweicht
