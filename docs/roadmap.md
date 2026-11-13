# Roadmap: Todo-App mit Listen

Stand: 2026-11-13 (Welle 4 geplant)

## Ziel

Eine Person führt im Browser mehrere Todo-Listen mit eigenen Einträgen. Einträge werden abgehakt,
Listen und Einträge per Drag and Drop angeordnet, Einträge auch zwischen Listen verschoben. Ein
Schalter zeigt nur offene Einträge. Am Ende startet `docker compose up` Datenbank, Backend und
Frontend auf dem eigenen Rechner, und jede Welle liefert einen Bildschirm, den die Person prüft.

## Nutzer

| Nutzer | Was sie damit tun |
|---|---|
| Die eine Person, die die App auf ihrem Rechner startet | Listen anlegen, umbenennen, löschen, anordnen; Einträge anlegen, abhaken, bearbeiten, löschen, innerhalb einer Liste und zwischen Listen verschieben; nur offene Einträge anzeigen |

## Nicht-Ziele

- Anmeldung, Konten, mehrere Personen (ADR 0003).
- Fälligkeitsdaten und Erinnerungen.
- Teilen von Listen mit anderen.
- Offline-Betrieb, PWA, mobile App.
- Anhänge, Notizen, Unteraufgaben: ein Eintrag ist ein Titel mit Status.
- Deployment auf einen Server (ADR 0004).

## Qualitätsziele

- Drag and Drop mit Maus, Touch und Tastatur; jedes Bedienelement per Tastatur erreichbar und mit
  zugänglichem Namen (A7.5).
- Oberfläche auf Deutsch; jeder Text über einen i18n-Schlüssel (A7.3), Sprachdateien je Feature.
- Eine Änderung ist nach der Antwort des Backends ohne Neuladen sichtbar (A7.2). Antwortzeit der
  API lokal unter 200 ms.
- Daten liegen in PostgreSQL und bleiben über Neustarts erhalten. Gelöscht wird nur, was die
  Person löscht.
- `make check` ist lokal und in CI grün. Integrationstests laufen gegen PostgreSQL im Container
  (T1.2). Jede Spec hat einen End-to-End-Fluss (T1.5), lokal mit `make e2e`.

## Grundentscheidungen

| Thema | Entscheidung | ADR |
|---|---|---|
| Stack | React 19 mit Vite, TypeScript, TanStack Query, dnd-kit, react-i18next; Go 1.23 mit net/http, pgx, sqlc, goose, slog; OpenAPI-Contract mit generierten Typen; Layout `frontend/` und `backend/` | `docs/adr/0001-stack-react-und-go.md` |
| Persistenz | PostgreSQL 17, Migrationen mit goose beim Start des Backends, Queries mit sqlc | `docs/adr/0002-postgresql-als-datenbank.md` |
| Authentifizierung | Eine Person, keine Anmeldung, keine Besitzerprüfung | `docs/adr/0003-eine-person-ohne-anmeldung.md` |
| Betrieb | Lokal mit Docker Compose (Datenbank, Backend, Frontend), kein Deployment | `docs/adr/0004-betrieb-lokal-mit-docker-compose.md` |
| Datenmodell Einträge | Tabelle `entries` mit Listenbezug, ein Endpunkt für alle Einträge | `docs/adr/0005-eintraege-als-eigene-tabelle.md` |
| Reihenfolge | Drag and Drop meldet die vollständige Id-Liste je Container; eine Transaktion setzt `position` | `docs/adr/0006-reihenfolge-als-id-liste.md` |

## Specs

<!-- Eine Zeile pro Spec. Welle 1 eines neuen Projekts ist das Grundgerüst allein. Specs einer
     Welle hängen nicht voneinander ab und ändern getrennte Bereiche (harness/decisions/0020).
     Bereiche: Verzeichnisse, Contracts, Manifeste, Migrationen, generierte Dateien.
     Der Status steht im Frontmatter der Spec (make specs), nicht hier. -->

| Spec | Titel | Welle | Hängt ab von | Bereiche | Risiko |
|---|---|---|---|---|---|
| 0001 | Grundgerüst | 1 | – | ganzes Repository | high |
| 0002 | Einträge anlegen, abhaken, bearbeiten und löschen | 2 | 0001 | `contracts/`, `backend/db/migrations/`, `backend/internal/entries/`, `frontend/src/features/entries/` | high |
| 0003 | Nur offene Einträge anzeigen | 3 | 0002 | `frontend/src/features/entries/` | medium |
| 0004 | Listen umbenennen und löschen | 3 | 0001 | `contracts/`, `backend/internal/lists/`, `frontend/src/features/lists/` | high |
| 0005 | Einträge per Drag and Drop verschieben, auch zwischen Listen | 4 | 0002, 0004 | `contracts/`, `backend/internal/entries/`, `frontend/src/features/entries/`, `frontend/package.json` | high |
| 0006 | Listen per Drag and Drop anordnen | 5 | 0005 | `contracts/`, `backend/internal/lists/`, `frontend/src/features/lists/` | high |

Jede Spec mit einem Endpunkt ändert `contracts/api/openapi.yaml` und die generierten Dateien,
darum liegt je Welle höchstens eine davon. Die Spalten `position` an Listen und Einträgen
entstehen mit ihren Tabellen (0001, 0002), damit 0005 und 0006 nur Endpunkte ergänzen.

## Offene Fragen

<!-- Eine beantwortete Frage bleibt stehen: - [x] <Frage> → <Antwort> (<Wer>, <Datum>) -->

- [x] Sollen die End-to-End-Tests in CI laufen (`e2e_in_ci: true`, Docker in der Setup-Action)?
      → Nein, sie laufen lokal mit `make e2e`; `verify` führt sie vor dem Merge aus.
      (Morten Möller, 2026-11-13)
- [x] Löscht das Löschen einer Liste ihre Einträge mit? → Ja, nach einer Rückfrage im Browser
      löscht das Backend Liste und Einträge in einer Transaktion. Betrifft 0004.
      (Morten Möller, 2026-11-13)
