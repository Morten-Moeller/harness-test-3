---
id: "0001"
title: Grundgerüst
status: done
risk: high
adrs: ["0001", "0002", "0003", "0004"]
owner: Morten Möller
created: 2026-11-13
updated: 2026-11-13
pr: "#1"
note: "freigegeben in der Session"
---

# Grundgerüst

## Ziel

Welle 1 der Roadmap (`docs/roadmap.md`): das Repository hat Struktur, Build und echte Gates für
React und Go, und ein Pfad vom Bildschirm bis zur Datenbank steht. Die Person startet
`docker compose up`, öffnet die App, sieht ihre Listen und legt eine neue an, die nach dem
Neuladen noch da ist. Dazu die vier ADRs der Grundentscheidungen, die ausgefüllten
Projektregeln und die sieben `README.md`, die der Bootstrap mit Harness 0.7.0 ausgelassen hat
(Changelog 0.7.1). Gelöst ist es, wenn `make check` lokal und in CI grün ist, `make e2e` den
Fluss im Browser prüft und jede folgende Spec nur noch ihr Feature ergänzt.

## Scope

### Enthalten

- Roadmap, ADRs 0001 bis 0004, Kopien der sieben `README.md` aus dem Harness-Repository
  (`/Users/mmoller/develop/60-AI/Harness`, Stand 0.7.1), `docs/architecture/overview.md`,
  `docs/domain/glossary.md`, `project-rules/*.md`, `README.md`.
- Layout `frontend/` und `backend/`, `src/` entfällt. `harness/config.yml` mit `source_paths`,
  `contracts_generate_target` und `worktree_setup`.
- Contract `contracts/api/openapi.yaml` mit `GET /api/lists` und `POST /api/lists`, generierte
  Typen für Backend und Frontend, Gate `drift`.
- Backend: Konfiguration aus der Umgebung, pgx-Pool, goose-Migration `lists`, sqlc-Queries,
  Problem Details, Request-Log mit Request-Id, Feature `lists` mit Integrationstests gegen
  PostgreSQL in testcontainers-go, Testdaten-Kommando `backend/cmd/seed`.
- Frontend: Vite, TanStack Query, react-i18next mit Namespace je Feature, Tokens, Seite
  `Listen` mit Formular `Neue Liste`, Vitest, Playwright-Fluss, eslint mit jsx-a11y und i18n-Check.
- Gates: `make test`, `make typecheck`, `make lint`, `make e2e`, `make generate`, `make install`,
  `make dev`, `make seed`, `make seed-doctor`. Setup-Action mit Go, Node, pnpm, golangci-lint.
  Dependabot für `gomod` und `npm`.
- `docker-compose.yml` mit `db`, `backend`, `frontend`; `backend/Dockerfile`,
  `frontend/Dockerfile` mit nginx.

### Nicht enthalten

- Einträge, Umbenennen und Löschen von Listen, Drag and Drop, Filter (Specs 0002 bis 0006).
- End-to-End-Tests in CI (`e2e_in_ci` bleibt `false`, offene Frage der Roadmap).
- Harness 0.7.1 übernehmen (`HARNESS_VERSION` bleibt `0.7.0`; eigene Spec über `update.sh`).
- Komponentenbibliothek, Dark Mode, weitere Sprachen.

## Begriffe

Neu; Schritt 1 legt sie in `docs/domain/glossary.md` an.

| Begriff | Bedeutung hier |
|---|---|
| Liste | Eine benannte Sammlung von Einträgen. Im Code `list`, Tabelle `lists`. Nicht verwenden: Board, Projekt, Kategorie. |
| Eintrag | Eine Aufgabe in genau einer Liste, mit Titel und Status. Im Code `entry` (ab 0002). Nicht verwenden: Task, Todo, Item. |
| offen / erledigt | Die zwei Status eines Eintrags. Im Code `done: boolean` (ab 0002). |
| Position | Ganzzahl, die die Reihenfolge von Listen und von Einträgen in einer Liste bestimmt; lückenhaft erlaubt, aufsteigend sortiert. Im Code `position`. Nicht verwenden: Rang, Index, Order. |

## Akzeptanzkriterien

| Nr | Kriterium | Prüfung |
|---|---|---|
| A1 | `make check` ist grün: `test` führt `go test ./...` und `vitest run` aus, `typecheck` `go vet` und `tsc --noEmit`, `lint` golangci-lint, eslint und den i18n-Check. Kein Stub bleibt. | `make check` |
| A2 | `GET /api/lists` antwortet 200 mit `{ "items": [...] }`, sortiert nach `position`; `POST /api/lists` mit `{ "title": "Einkauf" }` antwortet 201 mit `{ "id": <UUIDv7> }` und die Zeile hat `created_at` und `updated_at` in UTC; leerer oder über 200 Zeichen langer `title` antwortet 400 als `application/problem+json` mit `errorCode: VALIDATION_FAILED`. | Test |
| A3 | Beim Start wendet das Backend ausstehende Migrationen an; ein frischer Container hat danach die Tabelle `lists`. Eine fehlende Umgebungsvariable (`DATABASE_URL`, `HTTP_ADDR`, `LOG_LEVEL`) beendet den Start mit ihrem Namen. | Test |
| A4 | Die Seite `Listen` unter `http://localhost:5173` zeigt die vorhandenen Listen; das Formular `Neue Liste` legt eine Liste an, die ohne Neuladen erscheint und nach dem Neuladen bleibt; ein leerer Titel zeigt die Meldung aus `de.json`. Jeder Text kommt aus einem i18n-Schlüssel; Formular und Button tragen `data-testid`. | Browser und `make e2e` |
| A5 | `make seed STATE=empty` leert die Daten, `make seed STATE=with-lists` legt drei Listen an; beide drucken ein JSON-Dokument mit `ok` und `data`; `make seed-doctor` prüft die Datenbank und nennt den Fix. | Aufruf |
| A6 | `make generate` erzeugt `backend/internal/api/api.gen.go`, `backend/internal/store/` und `frontend/src/api/schema.d.ts`; `make drift` scheitert, wenn eine Kopie von der Quelle abweicht, und ist nach `make generate` grün. | Aufruf |
| A7 | Zwei `make test` in zwei Checkouts zur selben Zeit sind grün (T3.6): testcontainers-go wählt freie Ports, Vitest braucht keinen Port. Ohne Docker scheitert `make test` innerhalb von zehn Sekunden mit dem Hinweis auf Docker. | Aufruf |
| A8 | `docker compose up --build` startet `db`, `backend` und `frontend`; `http://localhost:8080` zeigt die Seite `Listen`, und `/api/lists` wird an das Backend weitergeleitet. | Aufruf und Browser |
| A9 | Die sieben `README.md` liegen an den Pfaden aus `## Umsetzung` und sind byteweise gleich mit dem Harness-Repository, bis auf `docs/adr/README.md`, das die vier ADR-Zeilen ergänzt. `project-rules/*.md` enthalten kein `TODO`. | Aufruf: `cmp`, `grep` |

## Contracts

`contracts/api/openapi.yaml`: neu. OpenAPI 3.1. Pfade `GET /api/lists` (200: `ListPage` mit
`items: List[]`), `POST /api/lists` (Body `CreateList { title }`, 201: `Created { id }`, 400:
`Problem`). Schema `List { id, title, position, createdAt, updatedAt }` in camelCase, Zeiten
RFC 3339 (A2.2). `Problem` nach RFC 9457 mit `errorCode` (A2.3). Konsument: das Frontend über
`frontend/src/api/schema.d.ts`. Generator: `make generate` (`contracts_generate_target`).
Abwärtskompatibilität: erster Stand, Version 1.

## Risiko

Stufe: high
Begründung: `harness/scripts/risk-level.sh`: `contracts/**`, `backend/db/migrations/**`,
`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` und `harness/config.yml` sind
high; `Makefile`, `.github/actions/**`, `project-rules/**`, `harness/**` medium; Manifeste
`go.mod`, `package.json`, `pnpm-lock.yaml` mindestens medium. Gates: `make check` in CI; Reviews
Code, Sicherheit, Architektur; `verified` durch `verify` (G3); das Label `human-approved` merged
(G2).
ADR nötig: ja, Bedingung 1 (high risk) und 2 (neue Abhängigkeiten) in `harness/policies/adr.md`:
ADRs 0001 (Stack), 0002 (Persistenz), 0003 (keine Anmeldung; ersetzt A5.1, A5.2, A2.5), 0004
(Betrieb). Die Freigabe dieser Spec nimmt sie an.

## Umsetzung

Entscheidungen:

- Neue Abhängigkeiten: Go 1.23 mit pgx, sqlc, goose, oapi-codegen, testcontainers-go,
  golangci-lint; Node 22 mit pnpm, Vite, React 19, TanStack Query, dnd-kit, react-i18next,
  openapi-typescript, openapi-fetch, Vitest, Playwright, eslint mit jsx-a11y und i18next,
  i18next-parser (ADR 0001).
- Contract `contracts/api/openapi.yaml` mit zwei Endpunkten; drei generierte Ziele über
  `make generate`, Gate `drift` aktiv (ADR 0001).
- Datenmodell: Tabelle `lists (id uuid, title text, position integer, created_at, updated_at)`;
  Migration beim Start des Backends (ADR 0002).
- Keine Anmeldung, keine Besitzerspalte: ADR 0003 ersetzt A5.1, A5.2, A2.5.
- Docker Compose mit drei Diensten und zwei Dockerfiles; `src/` entfällt, `source_paths` auf
  `frontend/src` und `backend` (ADR 0004).

Dateien:

- `docs/roadmap.md`: neu, Roadmap dieser Session
- `docs/adr/0001-stack-react-und-go.md`: neu
- `docs/adr/0002-postgresql-als-datenbank.md`: neu
- `docs/adr/0003-eine-person-ohne-anmeldung.md`: neu
- `docs/adr/0004-betrieb-lokal-mit-docker-compose.md`: neu
- `docs/adr/README.md`: neu, Kopie aus dem Harness-Repository plus vier ADR-Zeilen
- `docs/specs/README.md`: neu, Kopie aus dem Harness-Repository
- `docs/domain/README.md`: neu, Kopie aus dem Harness-Repository
- `docs/architecture/README.md`: neu, Kopie aus dem Harness-Repository
- `contracts/README.md`: neu, Kopie aus dem Harness-Repository
- `project-rules/README.md`: neu, Kopie aus dem Harness-Repository
- `harness/README.md`: neu, Kopie aus dem Harness-Repository
- `docs/architecture/overview.md`: ändern, Kontext (Person, Browser), Container (frontend, backend, db), Modulgrenzen, Querschnitt
- `docs/domain/glossary.md`: ändern, Begriffe Liste, Eintrag, offen, erledigt, Position
- `project-rules/frontend.md`: ändern, Stack, Struktur je Feature, Namespaces, Tokens, Checks
- `project-rules/backend.md`: ändern, Stack, Struktur je Feature und `platform`, Migrationen, Problem Details, Konfiguration, ADR 0003
- `project-rules/testing.md`: ändern, Ebenen, Bereiche, End-to-End, Testdaten-Kommando, was `verify` läuft
- `README.md`: ändern, Zweck, Setup, `docker compose up`, `make dev`
- `harness/config.yml`: ändern, `source_paths` (`frontend/src`, `backend`), `contracts_generate_target: generate`, `worktree_setup: "make setup && make install"`
- `Makefile`: ändern, `test`, `typecheck`, `lint`, `e2e`, `generate`, `install`, `dev`, `seed`, `seed-doctor`
- `.github/actions/setup/action.yml`: ändern, Go 1.23, Node 22 mit pnpm, golangci-lint, sqlc, oapi-codegen, `pnpm install --frozen-lockfile`, `go mod download`
- `.github/dependabot.yml`: ändern, `gomod` für `/backend`, `npm` für `/frontend`
- `.gitattributes`: ändern, generierte Pfade `linguist-generated=true`
- `.gitignore`: ändern, `frontend/dist`, `frontend/test-results`, `frontend/playwright-report`, `backend/bin`
- `src/.gitkeep`: löschen
- `docker-compose.yml`: neu, Dienste `db`, `backend`, `frontend`
- `contracts/api/openapi.yaml`: neu
- `backend/go.mod`: neu
- `backend/go.sum`: neu
- `backend/.golangci.yml`: neu
- `backend/sqlc.yaml`: neu
- `backend/oapi-codegen.yaml`: neu
- `backend/Dockerfile`: neu, Multi-Stage, statisches Binary
- `backend/cmd/server/main.go`: neu, Konfiguration lesen, Pool, Migrationen, Server starten
- `backend/cmd/seed/main.go`: neu, Zustände `empty` und `with-lists`, Option `--doctor`, JSON-Ausgabe
- `backend/db/migrations/00001_lists.sql`: neu, goose Up und Down
- `backend/db/queries/lists.sql`: neu, `ListLists`, `CreateList`
- `backend/internal/store/db.go`: neu, generiert (sqlc)
- `backend/internal/store/models.go`: neu, generiert (sqlc)
- `backend/internal/store/lists.sql.go`: neu, generiert (sqlc)
- `backend/internal/api/api.gen.go`: neu, generiert (oapi-codegen, Typen und Server-Interface)
- `backend/internal/platform/config/config.go`: neu, `DATABASE_URL`, `HTTP_ADDR`, `LOG_LEVEL` aus der Umgebung, Prüfung beim Start (A6.1)
- `backend/internal/platform/config/config_test.go`: neu, tabellengetrieben, fehlende Variable
- `backend/internal/platform/db/pool.go`: neu, pgx-Pool
- `backend/internal/platform/db/migrate.go`: neu, goose mit eingebetteten Migrationen
- `backend/internal/platform/problem/problem.go`: neu, RFC 9457 mit `errorCode`, Schreiben der Antwort
- `backend/internal/platform/requestlog/middleware.go`: neu, Request-Id und slog je Request (A6.4)
- `backend/internal/platform/server/server.go`: neu, Mux, Middleware, Verdrahtung des generierten Interfaces
- `backend/internal/platform/testdb/testdb.go`: neu, PostgreSQL über testcontainers-go, Migrationen, Docker-Prüfung mit Hinweis (T4.3)
- `backend/internal/lists/handler.go`: neu, `GET /api/lists`, `POST /api/lists`, Validierung an der Grenze (A3.1), UUIDv7
- `backend/internal/lists/handler_test.go`: neu, Integrationstests A2
- `frontend/package.json`: neu
- `frontend/pnpm-lock.yaml`: neu
- `frontend/pnpm-workspace.yaml`: neu, `minimumReleaseAge`, `blockExoticSubdeps`, `trustPolicy` für Semgrep
- `frontend/.nvmrc`: neu, `22`
- `frontend/index.html`: neu
- `frontend/vite.config.ts`: neu, Proxy `/api`, Vitest
- `frontend/tsconfig.json`: neu, strict
- `frontend/eslint.config.js`: neu, typescript-eslint, react-hooks, jsx-a11y, i18next
- `frontend/i18next-parser.config.js`: neu, Namespaces je Feature, Check auf fehlende und ungenutzte Schlüssel
- `frontend/playwright.config.ts`: neu, `webServer` für Backend und Vite, `globalSetup`
- `frontend/Dockerfile`: neu, Build und nginx
- `frontend/nginx.conf`: neu, statische Dateien, `config.json`, Proxy `/api`
- `frontend/public/config.json`: neu, `apiBaseUrl` (A6.2)
- `frontend/src/main.tsx`: neu
- `frontend/src/app/App.tsx`: neu, Provider und Seite
- `frontend/src/app/config.ts`: neu, `config.json` laden und prüfen
- `frontend/src/app/i18n.ts`: neu, react-i18next mit Namespaces
- `frontend/src/app/queryClient.ts`: neu
- `frontend/src/api/client.ts`: neu, openapi-fetch mit `apiBaseUrl`
- `frontend/src/api/problem.ts`: neu, Problem Details lesen, Verzweigung nach `errorCode`
- `frontend/src/api/problem.test.ts`: neu, Vitest, tabellengetrieben
- `frontend/src/api/schema.d.ts`: neu, generiert (openapi-typescript)
- `frontend/src/features/lists/ListsPage.tsx`: neu, Seite `Listen`, Formular `Neue Liste`, `data-testid`
- `frontend/src/features/lists/ListsPage.module.css`: neu, nur Tokens
- `frontend/src/features/lists/listsApi.ts`: neu, Query und Mutation mit Invalidierung (A7.2)
- `frontend/src/features/lists/locales/de.json`: neu, Namespace `lists`
- `frontend/src/styles/tokens.css`: neu, Farben, Abstände, Schrift
- `frontend/src/styles/global.css`: neu
- `frontend/e2e/global-setup.ts`: neu, Umgebungsprüfung, `make seed STATE=empty`
- `frontend/e2e/lists.spec.ts`: neu, Fluss A4

Schritte:

1. Dokumente: die sieben `README.md` kopieren, `docs/adr/README.md` ergänzen; Roadmap und ADRs
   liegen aus dieser Session vor; Glossar, `overview.md`, `project-rules/*.md`, `README.md`
   ausfüllen. `src/.gitkeep` löschen.
2. Contract `contracts/api/openapi.yaml`. `backend/go.mod`, `sqlc.yaml`, `oapi-codegen.yaml`,
   Migration `00001_lists.sql`, Queries `lists.sql`; `make generate` für `store/` und
   `api.gen.go`.
3. Backend-Plattform: `config`, `db`, `problem`, `requestlog`, `server`, `testdb`. Feature
   `lists` mit `handler.go` und `handler_test.go`. `cmd/server`, `cmd/seed`.
4. Frontend: Manifest und Konfiguration, `app/`, `api/` mit `schema.d.ts` aus `make generate`,
   Feature `lists` mit Seite, Formular, Namespace `de.json`, Tokens, `problem.test.ts`.
5. Gates: `Makefile` mit `test`, `typecheck`, `lint`, `e2e`, `generate`, `install`, `dev`,
   `seed`, `seed-doctor`; `harness/config.yml`; Setup-Action; Dependabot; `.gitattributes`;
   `.gitignore`.
6. Betrieb: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `nginx.conf`,
   `config.json`.
7. End-to-End: `playwright.config.ts`, `global-setup.ts`, `lists.spec.ts`; `make e2e` unter
   `harness/scripts/app-lock.sh`.
8. `make check`, `make e2e`, `docker compose up --build` (A8), Aufrufe A5 bis A7 und A9; PR,
   `review`, `verify`.

Testdaten: `make seed STATE=empty` vor `make e2e` (Global Setup); `make seed STATE=with-lists`
für den Browser-Gang A4 und A8.

Tests:

| Kriterium | Test |
|---|---|
| A1 | `make check` |
| A2 | `backend/internal/lists/handler_test.go`: `lists lists in position order`, `creates a list and returns its id`, `rejects an empty title with VALIDATION_FAILED`, `rejects a title over 200 characters` |
| A3 | `backend/internal/platform/testdb/testdb.go` wendet die Migrationen auf einen frischen Container an (jeder Lauf von `handler_test.go`); `backend/internal/platform/config/config_test.go`: `stops with the name of a missing variable` |
| A4 | `frontend/e2e/lists.spec.ts`: `creates a list and shows it after reload`, `shows the validation message for an empty title` / Browser: Seite `Listen` |
| A5 | Aufruf `make seed STATE=empty`, `make seed STATE=with-lists`, `make seed-doctor`, Ausgabe als JSON prüfen |
| A6 | Aufruf `make generate`, `make drift`; eine Zeile in `api.gen.go` ändern, `make drift` scheitert |
| A7 | Aufruf: zwei Checkouts, `make test` parallel; `make test` mit gestopptem Docker |
| A8 | Aufruf `docker compose up --build` / Browser: `http://localhost:8080` |
| A9 | Aufruf `cmp` je Datei gegen `/Users/mmoller/develop/60-AI/Harness/<pfad>`; `grep -L TODO project-rules/*.md` |

## Offene Fragen

- [x] Gilt die Stufe high für die README-Kopien, und welches ADR deckt sie ab? → Die Spec ist
      das Grundgerüst der Welle 1, high durch Contract, Migration und Compose; die ADRs 0001 bis
      0004 decken sie ab. (Roadmap-Lauf, 2026-11-13)
- [x] Erweitert `/roadmap` diese Spec oder bekommt das Grundgerüst die Nummer 0002? → Diese Spec
      ist das Grundgerüst. (Roadmap-Lauf, 2026-11-13)

## Verifikationsplan

- make check
- betroffene Tests: `backend/internal/...` (`go test ./...`), `frontend/src/api/problem.test.ts`,
  `frontend/e2e/lists.spec.ts` über `make e2e`
- Aufrufe: A5, A6, A7, A9
- Browser: Seite `Listen` unter `http://localhost:5173` (`make dev`) und `http://localhost:8080`
  (`docker compose up --build`), mit `make seed STATE=with-lists`
