---
sources: []
---

# Frontend rules

<!-- TODO: fill at project start. Delete sections that do not apply. -->

## Stack

- Framework and version: TODO
- Package manager and Node version: TODO
- Build tool: TODO

## Structure

- Where a feature lives (folder per feature, per layer, ...): TODO
- Shared code goes to: TODO
- Import boundaries (what may import what): TODO

## State and data

- Server state: TODO
- Client state: TODO
- API client and generated types (see `contracts/README.md`): TODO

## UI

- Component library and design tokens: TODO. Token values are the design team's decision; report,
  do not change, unless a design specification names the value.
- Styling approach: TODO
- i18n: every user-facing string goes through TODO. No hard-coded text.
- Accessibility: keyboard reachable, labelled controls, contrast checked. Findings on colour values
  are reported, not fixed.

## Quality

- `make typecheck`, `make lint` run: TODO
- Bundle budget: TODO
