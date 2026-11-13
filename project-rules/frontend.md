---
sources: [frontend/src/**, frontend/vite.config.ts, frontend/eslint.config.js, frontend/i18next.config.ts, frontend/package.json]
---

# Frontend rules

## Stack

- React 19 with TypeScript, strict mode. Build and dev server: Vite (`frontend/vite.config.ts`).
- Package manager pnpm (version in `frontend/Dockerfile`), Node version in `frontend/.nvmrc`.
- Server state: TanStack Query. i18n: i18next with react-i18next. Drag and drop: dnd-kit
  (ADR 0001).

## Structure

- One folder per feature under `frontend/src/features/<feature>/`: the page, the queries and
  mutations (`<feature>Api.ts`), the styles (`*.module.css`) and the language file
  (`locales/de.json`, the i18next namespace `<feature>`).
- `frontend/src/app/` wires providers, runtime config and i18n. `frontend/src/api/` holds the
  generated schema (`schema.d.ts`), the client and the problem details parser.
- Imports: a feature imports from `api` and `app`, never from another feature. `app` and `api`
  import no feature by name (`app/i18n.ts` loads the language files through a glob).

## State and data

- Server data lives in the query cache (A7.1). A mutation invalidates the queries it changes
  (A7.2); no manual reload.
- Client state is local to its component (`useState`). Settings and interaction state that
  several components of one feature share live in a React context of that feature
  (`OpenOnlyProvider` under `features/entries/`), provided by `app/App.tsx`.
  No global store.
- API calls go through `useApi()` (openapi-fetch with the types from `schema.d.ts`). A failed
  call throws `ApiError`; the UI branches on `errorCodeOf(error)`, never on message text (A2.3).
- Runtime configuration comes from `/config.json` at start (`app/config.ts`, A6.2).

## UI

- No component library. Colors, spacing, radii and type come from the tokens in
  `frontend/src/styles/tokens.css`; a component uses `var(--token)` only, never a literal value
  (A7.4). Token values are the design decision of the person; report, do not change.
- Styling: CSS modules next to the component.
- i18n: every user-facing string goes through `t('key')` of the feature namespace; the language
  file is `locales/de.json` of the feature (geprüft: eslint `i18next/no-literal-string` for JSX
  text, `i18next-cli extract --ci` for missing and unused keys).
- Accessibility: every control has a label or an accessible name and works with the keyboard;
  visible focus through `--color-focus` (geprüft: eslint `jsx-a11y`).
- Elements that end-to-end tests drive carry `data-testid` (A7.6).
- Drag and drop: dnd-kit. One `DndContext` for the page in `app/DndRoot.tsx` (ADR 0007). Each
  feature delivers a drag module through a hook (`useEntriesDnd`, `useListsDnd`, type
  `DndModule` in `app/dndModule.ts`): its drag type, the targets it accepts (also for the
  keyboard), collision, events, overlay, announcements and a `wrap` for its preview context.
  A handle button per item with an
  `aria-label`, `PointerSensor` with a 5 px activation distance so clicks keep working,
  `KeyboardSensor` with `sortableKeyboardCoordinates`, screen reader announcements and
  instructions through i18n. The new order is computed in a pure function with a unit test and
  sent as the complete id list of the target container (ADR 0006).

## Quality

- `make typecheck` runs `tsc --noEmit`; `make lint` runs eslint (typescript-eslint, react-hooks,
  jsx-a11y, i18next) and `i18next-cli extract --ci`; `make test` runs Vitest for
  `src/**/*.test.ts`.
- Bundle budget: none yet.
