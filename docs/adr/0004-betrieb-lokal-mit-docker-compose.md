# 0004: Betrieb lokal mit Docker Compose, kein Deployment

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0001-grundgeruest.md
Ersetzt Grundregeln: keine

## Kontext

Die App läuft auf dem Rechner der einen Person. Sie braucht PostgreSQL (ADR 0002), das Backend
und das Frontend. Die Grundregel A6.2 verlangt einen Build für jede Umgebung mit Konfiguration
zur Laufzeit; A6.1 Konfiguration aus Umgebungsvariablen.

## Optionen

### Option A: Docker Compose mit drei Diensten

- Vorteile: `docker compose up` startet alles; die Datenbank läuft auch für `make dev` und
  `make e2e` aus derselben Datei; Images je Dienst (`backend/Dockerfile`, `frontend/Dockerfile`
  mit nginx) sind der eine Build nach A6.2.
- Nachteile: Dockerfiles und Compose sind high risk in der Risikomatrix; Docker ist
  Voraussetzung.

### Option B: Nur die Datenbank im Container, Backend und Frontend als lokale Prozesse

- Vorteile: weniger Dateien in Welle 1.
- Nachteile: die Person braucht Go und Node installiert, um die App zu nutzen; kein fertiges
  Artefakt.

### Option C: Deployment auf einen Server

- Vorteile: Nutzung von überall.
- Nachteile: nicht gefordert; braucht Betrieb, TLS und Anmeldung (ADR 0003).

## Entscheidung

Option A. `docker-compose.yml` im Wurzelverzeichnis mit den Diensten `db` (`postgres:17`,
Volume), `backend` (Image aus `backend/Dockerfile`, Umgebungsvariablen `DATABASE_URL`,
`HTTP_ADDR`, `LOG_LEVEL`) und `frontend` (Image aus `frontend/Dockerfile`: nginx liefert das
Build und `config.json` und leitet `/api` an das Backend weiter). Entwicklung: `make dev` startet
`db` aus Compose, das Backend mit `go run` und Vite mit Proxy auf `/api`. Kein Deployment in
dieser Roadmap.

## Folgen

- `README.md` nennt `docker compose up` und `make dev`.
- Das Frontend liest `apiBaseUrl` zur Laufzeit aus `config.json` (A6.2).
- Eine Deployment-Spec in einer späteren Roadmap ersetzt dieses ADR.
