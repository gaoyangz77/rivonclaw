# RivonClaw Extensions

Extensions are OpenClaw plugins that ship with RivonClaw. The gateway config
writer points OpenClaw at the entire `extensions/` directory, so public
extensions are discovered by manifest instead of being wired one by one.

Merchant-specific plugins live in `../extensions-merchant/` and are checked out
from the private merchant extensions repository in CI/dev environments.

## Public Extension Inventory

| Extension | Plugin ID | Type | Purpose |
| --- | --- | --- | --- |
| `channel-weixin` | `openclaw-weixin` | Channel plugin | Wrapper around the Tencent Weixin channel with RivonClaw compatibility fixes. |
| `rivonclaw-capability-manager` | `rivonclaw-capability-manager` | Hook/enforcement plugin | Enforces effective tool availability from entitlement, surface, run profile, and session context. |
| `rivonclaw-event-bridge` | `rivonclaw-event-bridge` | Hook/event plugin | Mirrors selected OpenClaw agent events into the panel event stream. |
| `rivonclaw-mobile-chat-channel` | `rivonclaw-mobile-chat-channel` | Channel plugin | Mobile chat channel and relay synchronization. |
| `rivonclaw-search-browser-fallback` | `rivonclaw-search-browser-fallback` | Hook plugin | Guides fallback to browser search when direct web-search credentials are unavailable. |

## Merchant Extension Inventory

These packages are part of the workspace when `extensions-merchant/` is present:

| Extension | Plugin ID | Purpose |
| --- | --- | --- |
| `rivonclaw-cloud-tools` | `rivonclaw-cloud-tools` | Dynamic backend-defined cloud tools. |
| `rivonclaw-cs` | `rivonclaw-cs` | Customer-service runtime support. |
| `rivonclaw-ecom` | `rivonclaw-ecom` | Ecommerce runtime support. |
| `rivonclaw-local-tools` | `rivonclaw-local-tools` | RivonClaw-owned local desktop tools. |

## Loading Model

`packages/gateway/src/config/config-writer.ts` adds plugin discovery paths to
`plugins.load.paths`:

- Dev: `<repo>/extensions`
- Packaged app: `process.resourcesPath + "/extensions"`
- Merchant plugins: sibling `extensions-merchant` paths when available

The generated `apps/desktop/src/generated/our-plugin-ids.ts` file is produced by
`scripts/generate-plugin-ids.mjs`; do not edit it manually.

## Required Files

Every extension must include:

- `openclaw.plugin.json`
- an entry point (`index.ts`, `index.mjs`, or a built file referenced by
  `package.json` `openclaw.extensions`)

Minimum manifest:

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Channel plugins also declare `channels` and `channelConfigs`.

## Development Checklist

1. Add `extensions/<name>/openclaw.plugin.json`.
2. Add the source entry point and package config if the extension needs a build.
3. Add the package to `pnpm-workspace.yaml` if it is a built package.
4. Run `pnpm build` so `scripts/generate-plugin-ids.mjs` refreshes plugin IDs.
5. Start the desktop app and check gateway logs for plugin discovery.
6. For packaged builds, verify the extension appears under
   `Contents/Resources/extensions/` or the Windows/Linux equivalent.

## Deprecated Extensions

These extension names were removed and should not be reintroduced without a new
architecture decision:

- `rivonclaw-policy`: replaced by current data-driven tool authority and
  OpenClaw-native skills/config behavior.
- `rivonclaw-tools`: replaced by vendor prompt patches and merchant/local tool
  extensions.
- `rivonclaw-file-permissions`: removed with the old file-permissions UI/table.
  OpenClaw native sandbox/tool policy remains the local boundary layer.
- `wecom` / `dingtalk`: old planned channel extensions that are not present in
  the current public extension tree.
