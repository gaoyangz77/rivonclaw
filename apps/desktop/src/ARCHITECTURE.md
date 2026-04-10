# Desktop src/ Architecture

## Layer Rules

```
┌─────────────────────────────────────────┐
│  app/          Application composition  │  ← Can import everything
│  (main, panel-server, store aggregation)│
├─────────────────────────────────────────┤
│  domains/      Feature domains          │  ← Can import infra/ + other domains
│  (auth, providers, channels, ...)       │  ← CANNOT import app/
├─────────────────────────────────────────┤
│  infra/        Generic infrastructure   │  ← CANNOT import domains or app/
│  (api/, proxy/)                         │
└─────────────────────────────────────────┘
```

**Import rules:**
- `infra/` → only external packages and other `infra/` files
- Domains → `infra/`, other domains, external packages
- `app/` → everything (it's the composition root)

These rules are enforced by `infra/api/__tests__/layer-boundary.test.ts`.

## Directory Reference

| Directory | Purpose | Key files |
|-----------|---------|-----------|
| `app/` | Electron lifecycle, HTTP server, store aggregation, API context | `main.ts`, `panel-server.ts`, `lifecycle.ts`, `gateway-runtime.ts`, `auth-runtime.ts`, `api-context.ts`, `register-all.ts`, `app/store/desktop-store.ts` |
| `infra/api/` | Route registry, HTTP utilities | `route-registry.ts`, `route-utils.ts` |
| `infra/proxy/` | System proxy detection, proxy-aware HTTP | `proxy-manager.ts`, `proxy-aware-network.ts` |
| `gateway/` | Gateway process lifecycle, RPC, config | `connection.ts`, `config-builder.ts`, `rpc-client-ref.ts` |
| `auth/` | Authentication, session management | `session.ts`, `session-ref.ts`, `api.ts` |
| `settings/` | App settings, permissions, agent config | `api.ts` |
| `providers/` | LLM provider keys, model management | `api.ts`, `llm-provider-manager.ts` |
| `channels/` | Messaging channel accounts, pairing | `api.ts`, `channel-manager.ts` |
| `cs-bridge/` | Customer service relay bridge | `api.ts`, `customer-service-bridge.ts` |
| `browser-profiles/` | Browser profile management, CDP, cookies | `api.ts`, `managed-browser-service.ts` |
| `mobile/` | Mobile pairing, device management | `api.ts`, `mobile-manager.ts` |
| `chat/` | Chat session metadata | `api.ts` |
| `skills/` | Skill marketplace, install/delete | `api.ts` |
| `usage/` | Token usage tracking, snapshots | `api.ts`, `session-usage.ts` |
| `cloud/` | Cloud GraphQL/REST proxy | `api.ts`, `cloud-client.ts` |
| `deps/` | Dependency provisioner | `api.ts`, `provisioner-window.ts` |
| `doctor/` | Diagnostics (openclaw doctor) | `api.ts` |
| `updater/` | Auto-update service | `auto-updater.ts` |
| `stt/` | Speech-to-text service | `stt-manager.ts` |
| `telemetry/` | Telemetry client + heartbeat | `telemetry-init.ts` |
| `tray/` | System tray icon + menu | `tray-icon.ts`, `tray-menu.ts` |
| `utils/` | Pure stateless helpers (no lifecycle) | `media-paths.ts`, `platform.ts` |
| `generated/` | Build-time generated files | `system-tool-catalog.ts` |

## Adding a new feature domain

1. Create `src/newdomain/`
2. Add `api.ts` with `registerNewDomainHandlers(registry)` — import `RouteRegistry` and `EndpointHandler` from `../infra/api/route-registry.js`, import `ApiContext` from `../app/api-context.js`
3. Add endpoint definitions to `packages/core/src/api-contract.ts`
4. Register in `app/register-all.ts`
5. If MST state is needed, create the model in the domain dir and mount it in `app/store/desktop-store.ts`

## Entry point

`src/main.ts` is a one-line shell (`import "./app/main.js"`) to keep the Electron build entry stable. All logic lives in `app/main.ts`.
