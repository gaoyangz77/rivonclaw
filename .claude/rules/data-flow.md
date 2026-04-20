# Desktop ↔ Panel Data Flow

## Communication Architecture

```
Panel → Desktop:      REST API (HTTP request/response)
Desktop → Panel:      SSE patch stream (push)
Backend → Desktop:    GraphQL subscriptions (graphql-ws over WebSocket)
```

Panel never talks to the cloud backend directly — all cloud requests go through Desktop's proxy (`/api/cloud/graphql` for GraphQL, `/api/cloud/*` for REST), which injects JWT and ingests responses into MST.

Backend pushes real-time updates to Desktop via GraphQL subscriptions (`shopUpdated`, `oauthComplete`, `updateAvailable`). Desktop ingests these into MST the same way as query responses — patches flow to Panel via SSE automatically.

### Unified SSE Stream (Desktop → Panel)

A single endpoint — `/api/events` — multiplexes everything, so each Panel
session opens EXACTLY ONE `EventSource` (keeping well under Chrome's
6-connection per-origin HTTP/1.1 limit). A separate one-shot
`/api/doctor/run` stream exists for diagnostics and is unaffected.

| Event name | Source store / emitter | Content |
|------------|------------------------|---------|
| `entity-snapshot` | MST `rootStore` (on connect) | Full entity-store snapshot |
| `entity-patch` | MST `rootStore.onPatch` | JSON-Patch bundles (batched per microtask) |
| `status-snapshot` | MST `runtimeStatusStore` (on connect) | Full runtime-status snapshot |
| `status-patch` | MST `runtimeStatusStore.onPatch` | JSON-Patch bundles (batched per microtask) |
| `inbound` | gateway event dispatcher | External user message arrived |
| `chat-mirror` | gateway event dispatcher | Agent event mirrored for non-webchat channels |
| `session-reset` | gateway event dispatcher | Clear run state for a session |
| `recipient-added` | gateway / pairing notifier | New allowlisted recipient |
| `oauth-complete` | backend GraphQL subscription | OAuth flow succeeded |
| `shop-updated` | backend GraphQL subscription | Shop upsert |
| `update-available` | updater | App update payload |

Snapshots fire synchronously on connect BEFORE any patch, so reconnects
self-heal without special client logic.

Server side: `apps/desktop/src/app/panel-event-bus.ts` (fan-out) +
`panel-server.ts` (module-scoped bus + `broadcastEvent` export).
Client side: `apps/panel/src/lib/event-bus.ts` (singleton `panelEventBus`).

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

| Store | Desktop file | Panel file | SSE event names | Purpose |
|-------|-------------|------------|-----------------|---------|
| **Entity Store** | `desktop-store.ts` | `entity-store.ts` | `entity-snapshot` / `entity-patch` | Business entities (shops, users, provider keys, surfaces, etc.) |
| **Runtime Status Store** | `runtime-status-store.ts` | `runtime-status-store.ts` | `status-snapshot` / `status-patch` | Transient runtime state (CS bridge status, app settings) |

Both stores multiplex over the unified `/api/events` SSE stream (see section above). Do not mix concerns between the two stores. Entity data goes in the entity store; ephemeral/config state goes in the runtime status store.

### WeChat accountId canonicalization

WeChat (`openclaw-weixin`) uses `xxx-im-bot` / `xxx-im-wechat` as the canonical `accountId` form everywhere in Desktop (SQLite `channel_accounts`, `openclaw.json`, MST `channelAccounts`) and on Panel. The upstream plugin's `loginWithQrWait` returns the raw `xxx@im.bot` / `xxx@im.wechat` form, which is normalized by `normalizeWeixinAccountId` (from `@rivonclaw/core`) at the Panel write boundary inside `QrLoginModal`. Desktop's `ChannelManager.{add,update,remove}Account` apply the same normalization defensively for URL-path and future callers. Existing installs are upgraded by SQLite migration 27 (`canonicalize_weixin_account_ids`) plus a one-shot `openclaw.json` sweep (`migrateWeixinAccountKeys`) run during Desktop startup. Dash form wins on conflict.

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

## LLM Key & Model Lifecycle

All LLM provider key and model management is centralized in `LLMProviderManager` (Desktop: `apps/desktop/src/store/llm-provider-manager.ts`, Panel: `apps/panel/src/store/models/LLMProviderModel.ts`).

### Authentication Flow

API keys are stored in the system Keychain (macOS) / DPAPI (Windows). At startup and on key changes, `syncAllAuthProfiles()` writes ALL provider keys to `auth-profiles.json` in the OpenClaw state directory. The gateway reads this file on each LLM turn — no restart needed for key changes.

LLM provider keys are **not** injected as environment variables. `resolveSecretEnv()` only handles non-LLM secrets (STT, file permissions). The gateway authenticates exclusively via `auth-profiles.json`.

### Model Switching

Model switches use `sessions.patch` RPC — no gateway restart, no config file write.

| Scope | Mechanism | Restart? |
|-------|-----------|----------|
| **Per-session** (ChatPage) | `llmManager.switchModelForSession(sessionKey, provider, model)` → `sessions.patch` RPC | No |
| **Global default** (ProvidersPage) | `llmManager.switchModel(keyId, model)` → SQLite + `writeDefaultModel` (config) + reset active sessions | No (hot reload only) |
| **Per-shop CS** (EcommercePage) | `llmManager.applyModelForSession(key, scope)` → scope resolution + `sessions.patch` RPC | No |

### Model Resolution Priority

When a session runs, OpenClaw resolves the model in this order:
1. **Session override** (`sessions.patch` — set by LLMProviderManager)
2. **Config default** (`agents.defaults.model.primary` — written by `writeDefaultModel`)
3. **Hardcoded fallback** (OpenClaw's DEFAULT_MODEL)

### Cloud GraphQL Proxy — Extension vs Panel Requests

Desktop's cloud GraphQL proxy (`cloud-graphql-routes.ts`) forwards requests from both Panel and gateway extensions to the backend. Only Panel responses are ingested into Desktop MST (`ingestGraphQLResponse`). Extension responses (marked with `X-Request-Source: extension` header) are returned directly without ingestion — this prevents tool execution results (which return partial entities) from overwriting complete store data.

## Telemetry Allowlist

Panel telemetry events (`trackEvent("event.name")`) are validated against `PANEL_EVENT_ALLOWLIST` in `apps/desktop/src/api-routes/handlers/settings.ts`. When adding a new `trackEvent` call in Panel, add the event name to the allowlist — otherwise it will be silently dropped (204 with no forwarding).
