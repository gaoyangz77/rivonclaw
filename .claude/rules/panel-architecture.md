# Panel Architecture Rules

These rules are enforced by `scripts/check-panel-architecture.mjs` (runs in
`pnpm lint`) and `apps/panel/test/architecture.test.ts` (runs in `pnpm test`).
Violations fail CI and pre-push hooks.

## Feature Directory Structure

Every route page lives in `pages/<feature>/<FeaturePage>.tsx`. The `pages/`
root must contain only feature subdirectories — never page files directly.

Each feature directory follows this layout:

```
pages/<feature>/
  <FeaturePage>.tsx       — page shell: hook composition + layout
  <feature>-types.ts      — feature-private types (optional)
  <feature>-utils.ts      — pure functions, no React (optional)
  hooks/                  — feature-private hooks
  components/             — feature-private components
```

## Feature Isolation

Files in `pages/<featureA>/` must not import from `pages/<featureB>/`. If two
features need the same code, extract it to a shared layer:

- `lib/` — pure utilities and data definitions
- `api/` — data fetching and mutations
- `store/` — MobX-State-Tree models and providers
- `components/` — reusable React components

## Shared Layer Boundary

Shared layers (`api/`, `lib/`, `store/`, `components/`, `providers/`, `layout/`,
`tutorial/`, `i18n/`, `hooks/`) must not import from `pages/`. Dependency
direction is always: pages -> shared layers, never the reverse.

## Route Registry

All route metadata — paths, page components, nav labels, icons, auth gates,
keepMounted behavior, module gates — is defined in `routes.tsx`.

- `App.tsx` must not import directly from `pages/`. It gets page components
  through `ROUTE_MAP` from `routes.tsx`.
- `Layout.tsx` must not declare `NAV_ITEMS`, `NAV_ICONS`, or
  `AUTH_REQUIRED_PATHS`. It reads route metadata from `ROUTES`.

When adding a new page:

1. Create `pages/<feature>/<FeaturePage>.tsx`
2. Add a `RouteEntry` in `routes.tsx`
3. Done — nav, routing, analytics, and auth are automatic.

## Page Decomposition Pattern

Large pages (>300 lines) should be decomposed into hooks and components within
their feature directory. The page file itself should be a thin composition
shell (~150-250 lines) that:

- Calls feature hooks for state management
- Wires callbacks between hooks
- Computes derived values
- Renders feature components

Hooks own state and side effects. Components are presentational and receive
props. Avoid passing entire hook return objects as props — pass specific
fields or domain-scoped objects.

## MST / API Consistency

Channel and mobile mutations must go through `entityStore.channelManager` /
`entityStore.mobileManager` / MST model actions — not standalone API wrappers.
This ensures Desktop -> MST -> SSE patch -> Panel auto-update consistency.

Do not add new standalone API wrappers for operations that have MST model
actions. If a model action is missing, add it to the appropriate model in
`store/models/`.