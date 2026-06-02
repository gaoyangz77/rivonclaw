<p align="center">
  <img src="assets/LOGO_EN.png" width="400" alt="RivonClaw">
</p>

<p align="center">
  English | <a href="README.zh-CN.md">中文</a>
</p>

## Why RivonClaw?

[OpenClaw](https://github.com/openclaw/openclaw) is a powerful agent runtime,
but operating it directly means managing config files, local processes, provider
credentials, channel plugins, and update workflows. RivonClaw packages that
runtime into a desktop application with a local panel, provider management,
mobile/channel integrations, ecommerce workflows, and release infrastructure.

OpenClaw is the engine; RivonClaw is the desktop cockpit and business layer.

## Current Features

- **Desktop runtime manager**: Electron desktop app that owns the OpenClaw
  gateway lifecycle, local HTTP panel server, update checks, and user data.
- **Local panel UI**: React/Vite panel for chat, providers, channels, skills,
  crons, usage, settings, account/billing, and gated ecommerce modules.
- **LLM provider management**: API-key, OAuth, custom OpenAI-compatible, local
  Ollama, subscription/coding-plan, proxy, model catalog, reauth, and usage
  surfaces.
- **Channel integrations**: OpenClaw channel configuration plus RivonClaw-owned
  mobile chat, Weixin wrapper, event bridge, and capability enforcement plugins.
- **Cloud-backed business modules**: authenticated cloud GraphQL proxy, account
  and billing state, TikTok/ecommerce surfaces, customer-service bridge, and
  affiliate workflow support.
- **Skills marketplace**: browse/install cloud skills, manage installed skills,
  and open the local user skills directory.
- **Token and key usage**: session usage aggregation plus per-key usage history
  and subscription quota fetches where providers support it.
- **Speech-to-text and extras**: STT credentials/transcription routes plus web
  search and embedding credential management.
- **Dynamic tool authority**: runtime tool visibility and enforcement via
  generated tool specs, run profiles, surfaces, and the capability-manager
  extension.
- **Auto-update and release pipeline**: electron-builder installers, update
  manifests, draft GitHub releases, production website promotion, and CDN refresh
  scripts.

## Prerequisites

| Tool | Version |
| --- | --- |
| Git | any |
| Node.js | >= 24 |
| pnpm | 10.6.2 |

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/gaoyangz77/rivonclaw.git
cd rivonclaw

# 2. Clone/build the pinned OpenClaw runtime and apply vendor patches
./scripts/setup-vendor.sh

# 3. Install workspace dependencies and build
pnpm install
pnpm build

# 4. Launch in dev mode
pnpm --filter @rivonclaw/desktop dev
```

The desktop app starts Electron, launches the OpenClaw gateway, and serves the
panel on a dynamically assigned localhost port. In dev mode the panel uses the
Vite dev server at `http://localhost:5180`.

## Repository Structure

```text
rivonclaw/
├── apps/
│   ├── desktop/              # Electron main process, local APIs, gateway runtime
│   └── panel/                # React management panel
├── packages/
│   ├── core/                 # Shared types, defaults, API contract, MST models
│   ├── device-id/            # Machine fingerprinting
│   ├── gateway/              # OpenClaw config, launcher, OAuth, skills, vendor helpers
│   ├── logger/               # Structured logging
│   ├── plugin-sdk/           # Helpers for RivonClaw/OpenClaw extensions
│   ├── proxy-router/         # Local proxy routing
│   ├── secrets/              # Keychain / DPAPI / fallback secret storage
│   ├── storage/              # SQLite repositories and migrations
│   ├── stt/                  # Speech-to-text abstractions
│   ├── telemetry/            # Telemetry client
│   └── updater/              # Update manifest client
├── extensions/
│   ├── channel-weixin/
│   ├── rivonclaw-capability-manager/
│   ├── rivonclaw-event-bridge/
│   ├── rivonclaw-mobile-chat-channel/
│   └── rivonclaw-search-browser-fallback/
├── extensions-merchant/      # Private merchant plugins checked out in CI/dev
├── server/                   # Backend, relay, website, telemetry, deploy scripts
├── scripts/                  # Repo automation
├── vendor-patches/openclaw/  # Replayable OpenClaw patches
└── vendor/openclaw/          # Pinned OpenClaw checkout (generated/ignored locally)
```

## Workspaces

The monorepo uses pnpm workspaces (`apps/*`, `packages/*`, `extensions/*`,
`extensions-merchant/*`) with Turbo for build orchestration.

### Apps

| Package | Description |
| --- | --- |
| `@rivonclaw/desktop` | Electron 40 desktop app. Owns app lifecycle, local API routes, gateway startup, config writes, storage, updater, telemetry, and cloud/CS/mobile bridges. |
| `@rivonclaw/panel` | React 19 + Vite 6 SPA. Implements chat, provider setup, channels, extras, skills, crons, usage, settings, account, billing, and ecommerce surfaces. |

### Packages

| Package | Description |
| --- | --- |
| `@rivonclaw/core` | Shared defaults, types, API route contract, provider catalog, MST models, generated GraphQL types, and utility helpers. |
| `@rivonclaw/gateway` | OpenClaw config writer, launcher, OAuth profile sync, channel config writer, model catalog reader, skills reload helper, and vendor helpers. |
| `@rivonclaw/storage` | SQLite repositories for settings, provider keys, usage, chat sessions, channel accounts/recipients, mobile pairings, tool selections, and CS escalations. |
| `@rivonclaw/secrets` | Platform-aware secret storage for API keys and OAuth credentials. |
| `@rivonclaw/proxy-router` | Local HTTP proxy router for provider and first-party network paths. |
| `@rivonclaw/stt` | STT provider utilities. |
| `@rivonclaw/telemetry` | Telemetry client with opt-in app events and business telemetry channels. |
| `@rivonclaw/updater` | Version and manifest utilities used by the desktop updater. |
| `@rivonclaw/logger` | Shared logger setup. |
| `@rivonclaw/device-id` | Stable device identity helpers. |
| `@rivonclaw/plugin-sdk` | Shared helpers for extension packages. |

### Extensions

| Package | Description |
| --- | --- |
| `openclaw-weixin` | Wrapper around the Tencent Weixin OpenClaw channel with RivonClaw compatibility fixes. |
| `@rivonclaw/rivonclaw-capability-manager` | Enforces effective tool availability for the current run context. |
| `@rivonclaw/rivonclaw-event-bridge` | Mirrors selected OpenClaw agent events into the panel event stream. |
| `@rivonclaw/rivonclaw-mobile-chat-channel` | Mobile chat channel plugin and relay synchronization logic. |
| `@rivonclaw/rivonclaw-search-browser-fallback` | Guides search fallback behavior when direct search credentials are unavailable. |

Merchant-specific plugins live in `extensions-merchant/*` and are checked out by
CI from the private merchant extensions repository.

## Scripts

```bash
pnpm build                    # Generate vendor artifacts, check extension deps, build all packages
pnpm dev                      # Run desktop + panel dev workflow
pnpm test                     # Run workspace tests
pnpm lint                     # Run workspace lint
pnpm format                   # Check formatting with oxfmt
pnpm format:fix               # Apply oxfmt formatting
pnpm check:vendor-boundary    # Verify vendor boundary rules
pnpm check:tools              # Verify generated tool IDs/i18n/backend consistency
```

Per-package examples:

```bash
pnpm --filter @rivonclaw/desktop dev
pnpm --filter @rivonclaw/desktop test
pnpm --filter @rivonclaw/desktop test:e2e
pnpm --filter @rivonclaw/desktop dist:mac:arm64
pnpm --filter @rivonclaw/desktop dist:win
pnpm --filter @rivonclaw/panel dev
pnpm --filter @rivonclaw/panel build
```

## Architecture

```text
Electron Desktop
  ├─ Local panel server and typed REST/SSE routes
  ├─ SQLite storage + OS secret store
  ├─ OpenClaw config writer and launcher
  ├─ Proxy-aware cloud GraphQL/REST clients
  ├─ Backend subscription client
  ├─ Channel / mobile / CS / ecommerce bridges
  └─ Auto-updater

React Panel
  ├─ Local REST APIs through Desktop
  ├─ Cloud GraphQL through Desktop proxy
  ├─ MST entity/runtime stores via /api/events
  └─ Chat, providers, channels, skills, crons, ecommerce, settings

OpenClaw Gateway
  ├─ Pinned vendor runtime
  ├─ Vendor patches from vendor-patches/openclaw
  ├─ Auto-discovered extensions
  └─ User-installed skills
```

The current Desktop ↔ Panel API source of truth is
[`packages/core/src/api/api-contract.ts`](packages/core/src/api/api-contract.ts).
The generated route reference lives at [`docs/API_ROUTES.md`](docs/API_ROUTES.md).

## Data Directories

Defaults are resolved by [`packages/core/src/node-utils/paths.ts`](packages/core/src/node-utils/paths.ts).

| Path | Purpose |
| --- | --- |
| `~/.rivonclaw/db.sqlite` | Desktop SQLite database |
| `~/.rivonclaw/logs/` | Application logs |
| `~/.rivonclaw/secrets/` | File-based secret fallback |
| `~/.rivonclaw/openclaw/` | OpenClaw state directory |
| `~/.rivonclaw/openclaw/openclaw.json` | Generated gateway config |
| `~/.rivonclaw/openclaw/agents/<agentId>/sessions/` | OpenClaw sessions |
| `~/.rivonclaw/openclaw/skills/` | User-installed skills |
| `~/.rivonclaw/openclaw/credentials/` | OAuth/channel/mobile credentials |

## Releases

The current release flow is documented in [`docs/RELEASE.md`](docs/RELEASE.md).
At a high level: bump `apps/desktop/package.json`, trigger the manual
`Build & Release` GitHub workflow, run `./scripts/test-local.sh`, publish the
draft GitHub Release with `./scripts/publish-release.sh`, then promote website
download files and CDN state from the `server/` repo.

## License

MIT. See [LICENSE](LICENSE).
