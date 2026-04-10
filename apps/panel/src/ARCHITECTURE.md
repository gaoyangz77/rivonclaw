# Panel Architecture Rules

## Feature Directory Structure

Every route page lives in `pages/<feature>/<FeaturePage>.tsx`. The `pages/` root
must contain only feature subdirectories -- never page files directly.

## Feature Isolation

Files in `pages/<featureA>/` must not import from `pages/<featureB>/`. If two
features need the same code, extract it to a shared layer:

- `lib/` -- pure utilities and data definitions
- `api/` -- data fetching and mutations
- `store/` -- MobX-State-Tree models and providers
- `components/` -- reusable React components

## Shared Layer Boundary

Shared layers (`api/`, `lib/`, `store/`, `components/`, `providers/`, `layout/`,
`tutorial/`, `i18n/`, `hooks/`) must not import from `pages/`. Dependency
direction is always: pages -> shared layers, never the reverse.

## Route Registry

All route metadata -- paths, page components, nav labels, icons, auth gates,
keepMounted behavior, module gates -- is defined in `routes.tsx`. App.tsx and
Layout.tsx consume this registry; they must not declare their own route or
navigation metadata.

When adding a new page:

1. Create `pages/<feature>/<FeaturePage>.tsx`
2. Add a RouteEntry in `routes.tsx`
3. Done -- nav, routing, analytics, and auth are automatic.

## Dead Code Deletion Policy

Before deleting any file, verify: zero import sites across the codebase, no
route reference in `routes.tsx`, and no test dependency. Record the grep
evidence.

## Enforcement

These rules are enforced by `scripts/check-panel-architecture.mjs`, which runs
as part of `pnpm lint` in `apps/panel/`. Violations fail CI.
