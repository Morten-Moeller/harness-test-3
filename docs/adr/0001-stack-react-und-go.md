# 0001: React mit Vite im Frontend, Go mit net/http im Backend, OpenAPI-Contract mit generierten Typen

Status: accepted
Datum: 2026-11-13
Spec: docs/specs/0001-grundgeruest.md
Ersetzt Grundregeln: keine

## Kontext

Die Person hat React und Go vorgegeben. Offen sind die Bibliotheken je Belang (A1.7: eine
Bibliothek pro Belang), die Form des Contracts (A2.1: Contract in `contracts/` mit generierten
Typen) und das Layout des Repositorys. Die Grundregeln verlangen einen Query-Cache (A7.1), i18n
(A7.3), Design-Tokens (A7.4), Tastaturbedienung (A7.5), strukturierte Logs (A6.4) und
Konfiguration aus der Umgebung (A6.1).

## Optionen

### Option A: Vite, TanStack Query, dnd-kit; Go net/http mit Standard-Mux, pgx, sqlc; OpenAPI mit oapi-codegen und openapi-typescript

- Vorteile: wenige Abhängigkeiten; der Standard-Mux von Go 1.22 kennt Methoden und Pfadparameter;
  sqlc erzeugt typisierte Queries ohne ORM (A4.5, A4.6); dnd-kit bringt Maus-, Touch- und
  Tastatursensor mit (A7.5); oapi-codegen erzeugt das Server-Interface aus dem Contract, das
  Frontend nutzt die gleichen Typen (A2.1).
- Nachteile: Routing-Gruppen und Middleware-Ketten von Hand; zwei Generatoren (sqlc, oapi-codegen)
  und ein dritter im Frontend, die `make generate` und das Gate `drift` abdecken.

### Option B: Next.js; Go mit chi und GORM; Typen von Hand

- Vorteile: Next.js und chi haben große Communities; GORM spart SQL beim Start.
- Nachteile: Next.js bringt Server-Rendering, das eine lokale Ein-Personen-App nicht braucht; GORM
  lädt Objektgraphen und verdeckt die Statements (A4.4, A4.5); handgeschriebene Typen verletzen
  A2.1.

### Option C: Option A mit @hello-pangea/dnd statt dnd-kit

- Vorteile: einfachere API für reine Listen.
- Nachteile: Tastatur- und Touch-Bedienung über Container hinweg sind schwächer; das Verschieben
  zwischen Listen (Spec 0005) ist der Kernfall.

## Entscheidung

Option A. Frontend: Vite, TypeScript, React 19, TanStack Query, dnd-kit, react-i18next,
CSS-Module mit Tokens in `frontend/src/styles/tokens.css`, Vitest, Playwright, pnpm, Node 22.
Backend: Go 1.23, `net/http` mit Standard-Mux, pgx, sqlc, goose, `log/slog`, golangci-lint.
Contract: OpenAPI 3.1 in `contracts/api/openapi.yaml`; `make generate` erzeugt
`backend/internal/api/api.gen.go` (oapi-codegen), `backend/internal/store/` (sqlc) und
`frontend/src/api/schema.d.ts` (openapi-typescript). Layout: `frontend/` und `backend/` als
eigene Wurzeln mit eigenem Manifest; `src/` entfällt. Fehler als RFC 9457 Problem Details mit
`errorCode` (A2.3). Ids als UUIDv7 aus dem Backend (A4.2).

## Folgen

- `project-rules/frontend.md` und `project-rules/backend.md` nennen diese Bibliotheken und die
  Ordnung nach Feature (`frontend/src/features/<feature>/`, `backend/internal/<feature>/`),
  Plattformcode unter `backend/internal/platform/`.
- `harness/config.yml`: `source_paths` auf `frontend/src` und `backend`,
  `contracts_generate_target: generate`.
- Sprachdateien liegen je Feature (`frontend/src/features/<feature>/locales/de.json`) als
  i18next-Namespace, damit Specs einer Welle keine gemeinsame Datei ändern.
- Eine zweite Bibliothek für einen dieser Belange braucht ein neues ADR (A1.7).
