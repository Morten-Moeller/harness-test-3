# 0002: PostgreSQL als Datenbank, Migrationen mit goose beim Start, Queries mit sqlc

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0001-grundgeruest.md
Ersetzt Grundregeln: keine

## Kontext

Listen und Einträge müssen Neustarts überleben. Die Grundregeln verlangen versionierte
Migrationen (A4.1), atomare Zustandsänderungen mit `RETURNING` (A4.4), parametrisierte Queries
(A4.6), `created_at` und `updated_at` in UTC (A4.3) und Integrationstests gegen die echte
Datenbank-Engine im Container (T1.2) mit freien Ports je Lauf (T3.6).

## Optionen

### Option A: PostgreSQL 17 im Container, goose, sqlc, testcontainers-go

- Vorteile: eine Engine für Betrieb und Tests; `UPDATE ... RETURNING` und Transaktionen wie in
  A4.4 vorgesehen; testcontainers-go startet je Testpaket einen Container auf einem freien Port
  (T3.6); Docker Compose liefert die Datenbank lokal (ADR 0004).
- Nachteile: Docker ist Voraussetzung für `make test`, lokal und in CI.

### Option B: SQLite als Datei

- Vorteile: kein Container, eine Datei.
- Nachteile: Tests und Anwendung teilen Dateipfade; parallele Testläufe (T3.6) brauchen eigene
  Dateien und Sperren; `RETURNING` und Typen weichen von PostgreSQL ab, und ein späterer Wechsel
  ändert jede Query.

## Entscheidung

Option A. PostgreSQL 17. Migrationen als SQL-Dateien unter `backend/db/migrations/`, mit goose
eingebettet und beim Start des Backends angewendet (eine Person, ein Prozess; keine parallele
Instanz). Queries als SQL unter `backend/db/queries/`, von sqlc nach
`backend/internal/store/` generiert. Tests starten PostgreSQL mit testcontainers-go und wenden
die Migrationen an; jeder Test legt seine Daten mit eindeutigen Werten an (T3.1). Ein fehlendes
Docker beendet `make test` innerhalb von Sekunden mit dem Hinweis (T4.3).

## Folgen

- `project-rules/backend.md` nennt goose, sqlc, pgx und die Regel: eine Migration je Änderung,
  high risk.
- `project-rules/testing.md` nennt testcontainers-go und das Container-Image `postgres:17`.
- Die Setup-Action in CI braucht Docker (auf `ubuntu-latest` vorhanden) und Go.
- Testdaten kommen aus `backend/cmd/seed` (`make seed STATE=<name>`), nie von Hand.
