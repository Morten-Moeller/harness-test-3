# Systemübersicht

## Kontext

| Akteur / System | Rolle | Schnittstelle |
|---|---|---|
| Die Person | Führt ihre Listen und Einträge im Browser. | Frontend unter `http://localhost:8080` (Compose) oder `http://localhost:5173` (`make dev`) |
| Browser | Lädt das Frontend und ruft die API auf. | HTTP, `/api/*` nach `contracts/api/openapi.yaml` |

Keine fremden Systeme. Keine Anmeldung (ADR 0003).

## Container

| Container | Technik | Verantwortung | Spricht mit |
|---|---|---|---|
| `frontend` | React 19, Vite, nginx im Image | Bildschirme, Query-Cache, i18n; leitet `/api` an das Backend weiter | `backend` |
| `backend` | Go, `net/http`, pgx | API nach dem Contract, Validierung, Migrationen beim Start, Logs mit Request-Id | `db` |
| `db` | PostgreSQL 17 | Listen und Einträge | – |

Alle drei starten mit `docker compose up` (ADR 0004).

## Modulgrenzen

- Backend: ein Paket je Feature unter `backend/internal/<feature>/` (`lists`, ab 0002
  `entries`), das seine Endpunkte und seine Queries hält. Plattformcode unter
  `backend/internal/platform/` (`config`, `db`, `problem`, `requestlog`, `server`, `testdb`)
  kennt keine Fachbegriffe. Generiert: `backend/internal/api/` (Contract) und
  `backend/internal/store/` (sqlc). Features nutzen `platform`, `api` und `store`; `platform`
  nutzt kein Feature (A1.6).
- Frontend: ein Ordner je Feature unter `frontend/src/features/<feature>/` mit Seite, Queries
  und Sprachdatei (`locales/de.json` als i18next-Namespace). `frontend/src/app/` verdrahtet
  Provider und Konfiguration, `frontend/src/api/` den generierten Client. Features importieren
  aus `api` und `app`, nie aus einem anderen Feature.
- Contract first: ein Endpunkt steht in `contracts/api/openapi.yaml`, bevor es Code gibt;
  `make generate` erzeugt beide Seiten, `make drift` prüft sie.

## Querschnitt

- Authentifizierung und Autorisierung: keine, eine Person (ADR 0003).
- Logging: `log/slog` als JSON, ein Logger je Request mit `requestId`
  (`backend/internal/platform/requestlog`).
- Fehler: RFC 9457 Problem Details mit `errorCode` (`backend/internal/platform/problem`); das
  Frontend verzweigt in `frontend/src/api/problem.ts` nach `errorCode`.
- Konfiguration: Umgebungsvariablen `DATABASE_URL`, `HTTP_ADDR`, `LOG_LEVEL`, geprüft beim Start
  (`backend/internal/platform/config`); das Frontend liest `config.json` zur Laufzeit.
