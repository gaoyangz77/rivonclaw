# Desktop ↔ Panel Data Flow

## Communication Architecture

```
Panel → Desktop:  REST API (HTTP request/response)
Desktop → Panel:  SSE patch stream (push)
```

Panel never talks to the cloud backend directly — all cloud requests go through Desktop's proxy (`/api/cloud/graphql` for GraphQL, `/api/cloud/*` for REST), which injects JWT and ingests responses into MST.

## API Contract

All endpoint paths are defined in `packages/core/src/api-contract.ts` — the single source of truth.

- **Never hardcode path strings.** Import `API`, `SSE`, `clientPath`, or `buildPath` from `@rivonclaw/core/api-contract`.
- Desktop handlers reference `API["key"]` when registering with the route registry.
- Panel code uses `clientPath(API["key"], params?)` for `fetchJson` calls (strips `/api` prefix) and `SSE["key"].path` for EventSource connections.
- When adding a new endpoint: add it to `api-contract.ts` first, then register the handler, then add the Panel client call. The `route-coverage.test.ts` test will fail on push if a contract entry has no handler.

## MST Model Pattern (Core → Desktop → Panel)

| Layer | Location | Responsibility |
|-------|----------|---------------|
| **Core** | `packages/core/src/models/` | Pure data props (no actions, no side effects) |
| **Desktop** | `apps/desktop/src/store/` | Extends core model with **server-side actions** (storage read/write, gateway calls) |
| **Panel** | `apps/panel/src/store/models/` | Extends core model with **client-side actions** (REST calls to Desktop via `fetchJson`) |

**Follow this pattern for all new models.** Panel actions call REST → Desktop handles the write + updates MST → SSE patch flows back → Panel auto-re-renders via `observer()`.

## Two MST Stores

| Store | Desktop file | Panel file | SSE endpoint | Purpose |
|-------|-------------|------------|-------------|---------|
| **Entity Store** | `desktop-store.ts` | `entity-store.ts` | `/api/store/stream` | Business entities (shops, users, provider keys, surfaces, etc.) |
| **Runtime Status Store** | `runtime-status-store.ts` | `runtime-status-store.ts` | `/api/status/stream` | Transient runtime state (CS bridge status, app settings) |

Do not mix concerns between the two stores. Entity data goes in the entity store; ephemeral/config state goes in the runtime status store.

## AppSettings Flow

App settings live in `RuntimeStatusStore.appSettings`. The data flow:

1. **Desktop startup**: `runtimeStatusStore.loadAppSettings(storage.settings.getAll())`
2. **Panel read**: `runtimeStatus.appSettings.someField` (reactive via `observer()`)
3. **Panel write**: `runtimeStatus.appSettings.setSomeField(value)` → REST call → Desktop writes storage + updates MST → SSE patch back
4. **Desktop route handler**: after `storage.settings.set(key, value)`, always call `runtimeStatusStore.updateAppSetting(key, value)`

### Default Value Rules

- MST model defaults in `AppSettingsModel` must match the absent-value semantics of `SETTING_APPLIERS` in Desktop's `runtime-status-store.ts`.
- `isNotFalse` settings (opt-out): absent → `true`. Default in MST model must be `true`.
- `isTrue` settings (opt-in): absent → `false`. Default in MST model must be `false`.
- When referencing `DEFAULTS` from `defaults.ts`, verify it matches the storage-level absent semantic — they may differ (e.g., `DEFAULTS.settings.showAgentEvents` is `false` for UX intent, but storage absent = `true` because the old getter used `!== "false"`).

### SSE Snapshot Race Condition

Panel's SSE connection may deliver the snapshot after a page's `useEffect` fires. For pages that maintain **local draft state** (form fields the user edits before saving):

- Use `runtimeStatus.snapshotReceived` as a gate — don't seed draft state until it's `true`.
- Use a `dirty` flag — stop syncing from store once the user starts editing.
- Reset `dirty` after successful save so subsequent SSE patches update the form.

For pages that read `appSettings` **directly** (no local draft):

- Disable appSettings-backed controls with `disabled={saving || !runtimeStatus.snapshotReceived}` to prevent submitting MST defaults.

## Route Registry (Desktop)

All Desktop HTTP endpoints are registered via `RouteRegistry` in `apps/desktop/src/api-routes/route-registry.ts`.

- Handler files live in `apps/desktop/src/api-routes/handlers/`, one per domain.
- Each file exports a `register*Handlers(registry)` function.
- Handler signature: `(req, res, url, params, ctx) => Promise<void>` — no path checking, no boolean return.
- Parametric path segments (`:id`, `:channelId`) are extracted into `params` automatically.
- A few endpoints remain inline in `panel-server.ts` (SSE streams, app update closures) — these are listed in `PANEL_SERVER_CLOSURE_ROUTES` in `route-coverage.test.ts`.

## Telemetry Allowlist

Panel telemetry events (`trackEvent("event.name")`) are validated against `PANEL_EVENT_ALLOWLIST` in `apps/desktop/src/api-routes/handlers/settings.ts`. When adding a new `trackEvent` call in Panel, add the event name to the allowlist — otherwise it will be silently dropped (204 with no forwarding).
