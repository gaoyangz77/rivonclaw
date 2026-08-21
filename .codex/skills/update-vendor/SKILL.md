---
name: update-vendor
description: Update vendor/openclaw to a target commit hash (or latest origin/main), re-apply patches, regenerate vendor boundary artifacts and config documentation, rebuild, and run full test suite. Use when upgrading, pinning, or refreshing the vendored OpenClaw engine.
---

# Update Vendor

## Overview

This skill updates the vendored OpenClaw engine (`vendor/openclaw/`) to a new
commit, re-applies the carried patch stack, regenerates all vendor boundary
artifacts and config documentation, and runs the full build + test pipeline.
It produces a clean, verified vendor state with all downstream artifacts in sync.

## Workflow

### 1. Resolve target commit

If the caller specifies "latest", resolve to the actual commit hash:

```bash
git -C vendor/openclaw fetch origin
git -C vendor/openclaw log -1 --format=%H origin/main
```

If the caller provides an explicit hash, use it directly. Store the resolved
hash for use in subsequent steps.

### 2. Record old version

Read the current pinned hash from `.openclaw-version` before overwriting it.
This is needed for the diff comparison and final report.

```bash
cat .openclaw-version
```

Before provisioning, establish a reproducible baseline from the current vendor:

- Confirm the main repository is clean and the existing dev/prod E2E suite passes.
- Record Gateway startup-to-ready time and startup warnings using isolated state.
- Record the previous packaged app and installer sizes.
- Inventory representative legacy state surfaces: configured agents/workspaces,
  auth profiles, device identity, channel accounts and account-scoped recipients,
  session/transcript/conversation stores, and the largest state size/count.
- Preserve a sanitized fixture or synthetic equivalent for post-upgrade migration
  tests. Do not rely only on a fresh profile.

### 3. Provision the new vendor

Run the provision script with the resolved target hash:

```bash
bash .codex/skills/update-vendor/scripts/provision-vendor.sh <new-hash>
```

This script:
- Writes the new hash to `.openclaw-version`
- Removes and re-provisions `vendor/openclaw/` via `scripts/setup-vendor.sh`
- Fixes vendor git state (local `main` branch at pinned commit, clean tree)
- Verifies: branch=main, clean tree, 0 commits ahead of origin/main

`scripts/setup-vendor.sh` internally handles:
- Cloning from upstream at the specified hash
- Installing dependencies with `npm_config_node_linker=hoisted pnpm install --frozen-lockfile`
- **Auto-applying all patches** from `vendor-patches/openclaw/*.patch` via `git am --3way`
- Building vendor: `pnpm run build && pnpm ui:build`
- Creating `.dist-complete` marker for cache integrity

If provisioning fails (especially patch replay), stop and diagnose. Common
causes: patch conflicts with new vendor code. In that case, use the
`vendor-patch-authoring` skill to refresh the affected patches.

### 4. Validate patch replay

If `vendor-patches/openclaw/` contains patches, verify they replay cleanly
in an independent workspace:

```bash
bash scripts/provision-vendor-patched.sh --target tmp/vendor-patched/openclaw
```

This creates a disposable patched workspace by replaying the full patch stack
on the pristine vendor. If any patch fails to apply with `--3way`, that patch
needs to be refreshed or removed.

Replay success is not semantic compatibility. For every patch:

- Read its entry in `vendor-patches/openclaw/README.md` and inspect the cited
  upstream issue/PR/commit.
- Retire it only when the target vendor contains the upstream fix and the
  corresponding sentinel/behavior test passes without the patch.
- For retained patches, run their focused sentinel tests and verify the patched
  API still has the same ownership, lifecycle, and error semantics.

### 5. Compatibility audit

Check for breaking changes between the old and new vendor versions:

- **`packages/gateway/src/config-writer.ts`** — Verify `KNOWN_CONFIG_KEYS`
  matches the new vendor config schema. Check for added, removed, or renamed
  keys in `vendor/openclaw/src/config/zod-schema*.ts`.

- **`packages/gateway/src/rpc-client.ts`** — Check that RPC operator scopes
  and method signatures still match the vendor's RPC interface.

- **`extensions/easyclaw-tools/`** — Scan plugin implementations for
  compatibility with the vendor's plugin API (tool registration, lifecycle
  hooks, context shape).

- **`packages/core/src/defaults.ts`** — Verify default values still align
  with the vendor's expected defaults and config schema.

- **Core tool identity and projection** — Diff
  `vendor/openclaw/src/agents/tool-catalog.ts`, tool-name constants, aliases,
  and provider-specific dynamic-tool loading defaults. Regenerate
  `apps/desktop/src/generated/system-tool-catalog.ts`; do not leave renamed
  IDs (for example `cron` -> `automations`) in Surfaces, RunProfiles, or static
  defaults. Run the exact catalog-boundary test and fail the upgrade if the
  Desktop catalog differs from the pinned vendor. For every production model
  runtime, verify an authorized scheduler tool is directly callable or that
  its required discovery tool is actually present in the model request; a tool
  appearing in Gateway `tools.catalog` alone is not sufficient.

- **Persistence and startup migrations** — Diff vendor state ownership and
  migration behavior for sessions, transcripts, conversations, auth profiles,
  device identity, workspace state, pairing/allowlists, and agent databases.
  Compare this against `packages/gateway/src/vendor/state-migration.ts`; do not
  assume OpenClaw's own migration preserves RivonClaw-owned derived state.

- **Channel RPC contracts** — Diff channel/plugin SDK exports and every Gateway
  method used by Desktop channel adapters. Check required routing parameters,
  update-vs-send semantics, idempotency behavior, and callback payloads.

- **Bundled third-party extensions** — Build every RivonClaw extension and scan
  generated bundles for `openclaw/plugin-sdk/*` imports. Verify each referenced
  subpath is exported by the new `vendor/openclaw/package.json`; TypeScript and
  bundling success alone do not prove runtime compatibility.

- **Desktop packaging boundary** — Audit vendor dependency pruning, archived
  runtime contents, native modules, and CI vendor caches. Compare the packaged
  artifact size and runtime dependency graph with the last successful release.

- **Externalized plugin convergence** — Diff plugins that moved from bundled
  runtime code to official npm/ClawHub packages. For every provider or channel
  RivonClaw can configure (including environment-selected speech, media,
  embedding, and web providers), either stage the matching official plugin in
  the packaged vendor runtime or remove the obsolete configuration. A Desktop
  startup must never rely on customer-installed `npm`, `npx`, or `pnpm`.

Fix any breaking incompatibilities **in EasyClaw code only** (never in vendor).

### 6. Regenerate vendor boundary artifacts

Run the vendor artifact generator to update EasyClaw's generated boundary files:

```bash
pnpm run generate:vendor-artifacts
```

This extracts vendor schema and type definitions into EasyClaw packages so they
never import directly from `vendor/openclaw/`:
- Inlines vendor text utilities into `packages/core/src/generated/`
- Bundles vendor Zod schema into `packages/gateway/src/generated/`

### 7. Regenerate config reference documentation

**Mandatory on every vendor update.** The config doc must stay in sync.

1. Read ALL Zod schema files in `vendor/openclaw/src/config/zod-schema*.ts`
   and the type file `vendor/openclaw/src/config/types.openclaw.ts`.
2. Regenerate `docs/OPENCLAW_CONFIG.md` with updated schema documentation
   reflecting the new vendor version.
3. Update the vendor commit hash in the document header.

### 8. Build and test

**Step 1: Rebuild native modules**

```bash
bash scripts/rebuild-native.sh
```

Prebuilds `better-sqlite3` for both Node.js (unit tests) and Electron (app)
ABIs. Required after any `pnpm install` or vendor reprovisioning.

**Step 2: Full monorepo build**

```bash
pnpm run build
```

This runs Turbo's build pipeline including dependency checks, vendor artifact
generation (idempotent), and all workspace package builds.

**Step 3: Unit tests**

```bash
pnpm run test
```

Key tests that validate vendor integration:
- `packages/gateway/src/config-writer.test.ts` — schema parsing, config merging
- `packages/gateway/src/vendor.test.ts` — vendor directory/version resolution
- `packages/gateway/src/launcher.test.ts` — gateway startup integration

**Step 4: Full local test pipeline** (mandatory for release candidates)

```bash
bash scripts/test-local.sh
```

This comprehensive script runs: install → vendor check → native rebuild →
build → unit tests → e2e dev → pack → native rebuild (post-pack restore) →
e2e prod. Outputs a summary table with each step's status and duration.

It may be skipped only when the user explicitly requests that omission. Record
the omission in the final report and do not call the result release-ready.

If tests or build fail, diagnose and fix EasyClaw-side issues (never modify
vendor code). Re-run until green.

**Step 5: Upgrade-specific state migration tests** (mandatory)

Generic unit/E2E coverage is not sufficient for a storage or plugin-runtime
upgrade. Test with copies or synthetic equivalents of both fresh and legacy
state. Never mutate the operator's real state during these tests.

- Fresh install reaches Gateway `ready` without migration warnings.
- Existing auth credentials still permit one real model request after upgrade.
- Legacy device identity migrates without requiring the user to run
  `openclaw doctor --fix` manually.
- Existing configured workspaces and every configured agent database migrate.
- Legacy sessions/transcripts/conversations survive, and obsolete JSON storage
  is retired only after the SQLite data is complete.
- Account-scoped channel recipients/pairing allowlists survive. For Feishu,
  verify existing recipients remain attached to the correct account before any
  new inbound message recreates them.
- Migration is idempotent and safely resumes after an interrupted startup.
- Run a large-state fixture representative of production (at least 10,000
  sessions and roughly 500 MB when the storage format changes). Require bounded
  progress logs, eventual Gateway `ready`, and no unchanged retry loop. Record
  startup duration, idle CPU, one `sessions.list` latency, and CPU during active
  session updates so a storage migration does not merely become functionally
  correct but operationally unusable.
- Exercise Windows-style paths and the packaged native SQLite module, not only
  the Node.js development ABI on macOS.

**Step 6: Channel and CS smoke matrix** (mandatory)

Run these against the built Desktop app and packaged vendor runtime, not only
source-level mocks:

- `pnpm check:ext-deps` and `pnpm check:ext-externals` pass.
- Every bundled channel plugin is loaded by OpenClaw's real plugin loader. For
  non-vendor extensions, use `openclaw plugins inspect <id> --runtime --json`
  with isolated state and require `status: "loaded"`.
- Existing Feishu account: recipient list is present immediately after upgrade;
  direct and group inbound/outbound messages work.
- From both Chat and Feishu, create, list, and delete a disposable scheduled
  automation. Require an actual `automations` tool call; a prose claim that
  Agent Cron is unavailable is a release blocker. Also load a legacy profile
  containing the old `cron` tool ID and verify it resolves to `automations`.
- Send several Feishu messages in quick succession while one turn is running;
  verify accepted work is queued or merged according to the configured policy,
  not silently reduced to only the last message.
- Feishu streaming starts with `Thinking...`, transitions in the same card,
  produces no duplicate text/cards, and reaches a terminal state.
- Feishu quoted interactive cards expose their content to the Agent, and one
  small attachment plus one ZIP/XLSX below the configured limit is delivered
  exactly once with send failures visible to the Agent.
- Feishu CS escalation cards submit directly to the Backend HTTP callback; the
  event bridge and Gateway must not register or dispatch `rivonclaw.cs` card
  interactions. Verify the Desktop automatically configures the callback URL
  for both a newly scanned account and an existing account before sending a
  card. With Desktop/Gateway stopped or CPU-stalled, submitting a resolution
  must still update the original card to its resolved/green state, remove the
  form, create exactly one durable escalation event, and never emit a separate
  textual receipt. An unresolved response must keep the orange form available.
- Weixin: plugin runtime loads, QR login RPC methods register, and one message
  round trip works.
- Telegram and every other enabled production channel complete one basic round
  trip, so a wrong-account manual test is not mistaken for a runtime failure.
- Interrupt the Gateway during an accepted CS run, reconnect, and verify the
  final reply is recovered exactly once with no silent completion.

**Step 7: Packaged artifact and cache verification** (mandatory)

In addition to archive shape and size checks, run the packaged Gateway with an
isolated state directory and a deliberately empty `PATH`. Enable every staged
official external plugin used by production configuration (currently Feishu
and Groq speech/media) and require Gateway startup/doctor convergence to finish
without spawning `npm`, `npm.cmd`, `npx`, or `pnpm`. This test must use the
final pruned runtime/archive; a developer machine's globally installed Node
toolchain must not be visible to the child process.

- Run `pnpm --filter @rivonclaw/desktop verify:vendor-runtime` after pruning and
  against the packaged app resources.
- Compare unpacked size and installer size with the previous successful build;
  investigate material growth before publishing.
- Verify unwanted optional vendor plugins and dependencies are absent while all
  configured plugins remain loadable.
- Prove both a clean CI build and a vendor-cache-hit build. The cache marker must
  represent a complete installed and built vendor workspace, not only `dist/`.
- Launch the packaged app and inspect startup logs through Gateway `ready`.
  Treat `MODULE_NOT_FOUND`, `MigrationRequired`, missing provider auth, repeated
  migration, stale plugin, or plugin load diagnostics as release blockers.

Record every item above as pass/fail in the final report. If a mandatory item
cannot run locally, state why and do not describe the upgrade as release-ready.

### 9. Provider/model audit (if applicable)

If the vendor update includes model catalog changes, run a provider audit to
check for model coverage gaps. See `references/provider-audit.md` in this
skill directory for the audit process. Also verify each RivonClaw model's
context window survives generated-catalog regeneration, a near-threshold
session can compact successfully, and the compaction model/fallback is
available for users who configured only a subset of models.

### 10. Report

Summarize the update with:

- **Old hash** and **new hash**
- **Breaking changes found** — what changed in the vendor and how EasyClaw
  code was adapted
- **Config schema changes** — added, removed, or modified config keys
- **Patch replay status** — all patches applied cleanly, or which needed refresh
- **Test results** — unit tests, build, and e2e status
- **Upgrade acceptance matrix** — pass/fail for legacy-state migration, large
  state startup, each production channel, CS reconnect recovery, runtime plugin
  loading, packaged artifact sizing, and clean/cache-hit CI builds
- **Files modified** — list of EasyClaw files changed to accommodate the update

## Constraints

- **NEVER modify files under `vendor/`.** All adaptation happens in EasyClaw
  code. The vendor checkout must remain pristine at the pinned commit (plus
  auto-applied patches from `vendor-patches/openclaw/`).
- `vendor/openclaw/` is gitignored with its own `.git`; only `.openclaw-version`
  is tracked in the main repo.
- Use `npm_config_node_linker=hoisted` as an **env var**, never write to
  `.npmrc` — that file is tracked by vendor git and would cause dirty state.
- Never `rm -rf dist` before rebuilding vendor — `tsdown-build.mjs` is
  incremental and preserves the upstream bundler config. Full dist deletion
  breaks externals.
- Config doc regeneration (step 7) is mandatory — skipping it leaves
  `docs/OPENCLAW_CONFIG.md` out of sync with the actual vendor schema.
- Follow all principles in `.codex/rules/development-philosophy.md`.

## Output Requirements

A completed vendor update must leave behind:

- `.openclaw-version` updated to the new hash
- `vendor/openclaw/` provisioned and verified (main branch, clean tree, patches applied)
- All carried patches replaying cleanly on the new vendor
- Vendor boundary artifacts regenerated (`packages/*/src/generated/`)
- `docs/OPENCLAW_CONFIG.md` regenerated with current schema
- All EasyClaw code adapted to any breaking vendor changes
- Green build, unit tests, dev/prod E2E, upgrade migration matrix, channel/CS
  smoke matrix, and packaged runtime verification, unless the user explicitly
  accepted a documented omission
