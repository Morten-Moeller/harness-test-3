---
id: "0000"
title: <Titel der Änderung>
status: draft
risk: <low | medium | high, Vorschlag aus /risk>
adrs: []
owner: <Name der Person, die freigibt>
created: YYYY-MM-DD
updated: YYYY-MM-DD
pr: ""
note: ""
---

# <Titel der Änderung>

## Ziel

<!-- Zwei bis drei Sätze: welches Problem, für wen, woran erkennt man, dass es gelöst ist. -->

## Scope

### Enthalten

- ...

### Nicht enthalten

- ...

## Begriffe

<!-- Begriffe aus docs/domain/glossary.md, die diese Spec verwendet.
     Neue Begriffe zuerst dort anlegen. -->

| Begriff | Bedeutung hier |
|---|---|

## Akzeptanzkriterien

<!-- Jedes Kriterium ist prüfbar: durch einen Test, einen Aufruf oder einen Gang durch die
     Anwendung. Nennt ein Kriterium einen Bildschirm, prüft /verify ihn im Browser. -->

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | ... | Test / Aufruf / Bildschirm |
| A2 | ... | ... |

## Contracts

<!-- Welche Dateien in contracts/ sich ändern, ob die Änderung abwärtskompatibel ist, wer sie
     konsumiert. "keine" ist ein gültiger Wert. -->

## Risiko

<!-- Ergebnis von harness/scripts/risk-level.sh, Begründung, Eskalatoren.
     Welche Gates gelten (harness/policies/human-approval.md). -->

Stufe: <low | medium | high>
Begründung: ...
ADR nötig: <ja, Nr. | nein, weil ...>

## Umsetzung

<!-- Der Plan, den die Freigabe der Spec mit freigibt (G1). /implement hält nur an, wenn es
     davon abweichen muss: höhere Risikostufe, Dateien oder Contracts außerhalb dieser Liste,
     eine Entscheidung, die unten fehlt. -->

Entscheidungen:

<!-- Höchstens fünf Zeilen, sonst "keine": neue Abhängigkeiten, Contract- und API-Änderungen,
     Datenmodell und Migrationen, neue Module oder Dienste, Abweichungen von einer Regel (ADR).
     Diesen Block liest die Person bei der Freigabe. -->

- keine

Dateien:

<!-- Vollständige Pfade ab der Wurzel des Repositorys, eine Datei pro Zeile, ohne "...", "*"
     oder "a.ts|html". harness/scripts/wave-check.sh vergleicht sie zwischen Specs. -->

- `<pfad>`: <neu | ändern>, <was>

Schritte:

1. ...

Tests:

| Kriterium | Test |
|---|---|
| A1 | `<testdatei>`: <Fall> / Browser: <Bildschirm> |

## Offene Fragen

<!-- Fragen, die vor der Freigabe eine Person beantwortet. /spec stellt sie zusammen mit der
     Freigabefrage. Eine beantwortete Frage bleibt hier stehen:
     - [x] <Frage> → <Antwort> (<Wer>, <Datum>) -->

- [ ] ...

## Verifikationsplan

<!-- Welche automatischen Checks, welche Tests, welche Bildschirme. Was /verify abarbeitet. -->

- make check
- betroffene Tests: ...
- Browser: <Bildschirme oder "keiner">
