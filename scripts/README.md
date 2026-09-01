# Scripts

## Build & Release

### rebuild-native.sh

Builds `better-sqlite3` for both Node.js and Electron, enabling both runtimes to coexist.

Node.js and Electron have different ABIs (e.g. Node.js v24 = ABI 141, Electron 35 = ABI 143). A binary compiled for one crashes when loaded by the other. This script compiles `better-sqlite3` twice and places each binary in an ABI-specific directory under `lib/binding/`. It then deletes `build/` so the `bindings` package auto-selects the correct binary at runtime.

**When it runs:**
- Automatically after `pnpm install` via the root `postinstall` hook
- Manually: `./scripts/rebuild-native.sh` (or `--force` to skip the "already exists" check)

**Rules:**
- Do NOT run `electron-rebuild` manually — it creates `build/` and breaks Node.js tests
- Do NOT delete `lib/binding/` — it contains the dual prebuilds
- If unit tests fail with ABI mismatch errors, run `./scripts/rebuild-native.sh`

### setup-vendor.sh

Clones and builds `vendor/openclaw` from the commit pinned in `.openclaw-version`. Used by the README quick start, CI workflows, and `provision-vendor.sh`.

```bash
./scripts/setup-vendor.sh          # dev build (full deps)
./scripts/setup-vendor.sh --prod   # prod build (production deps only)
```

Every install and build runs through the exact pnpm release named by the vendor
`packageManager` field, resolved by `vendor-pnpm.cjs` (below). Node must satisfy
the vendor's own `engines.node` range — the vendor preinstall script rejects
anything else, so check `vendor/openclaw/package.json` before running this.

### vendor-pnpm.cjs

Resolves the pnpm release pinned by a vendor checkout and prints the absolute
path to its binary, installing it into `tmp/vendor-pnpm/<version>` on first use.
It installs **outside** the vendor tree on purpose: `vendor/openclaw/.npmrc`
sets a `min-release-age` dependency cooldown, and npm applies that cooldown to
whatever it resolves from inside the vendor directory — including the package
manager. A vendor pin newer than the cooldown window would otherwise fail with
"No matching version found for pnpm@&lt;version&gt;". The cooldown still governs
the vendor's own dependency install, which runs with the vendor directory as
cwd.

```bash
node scripts/vendor-pnpm.cjs vendor/openclaw
```

`setup-vendor.sh`, `provision-vendor-patched.sh`, and the electron-builder
`prune-vendor-deps.cjs` hook all go through this module.

### provision-vendor-patched.sh

Creates a disposable patched OpenClaw workspace from pristine `vendor/openclaw`
plus the replayable patch stack in `vendor-patches/openclaw/`. The default
target is `tmp/vendor-patched/openclaw`.

```bash
./scripts/provision-vendor-patched.sh
./scripts/provision-vendor-patched.sh --skip-build
./scripts/provision-vendor-patched.sh --target /tmp/openclaw-patched --prod
```

Use this for vendor patch replay validation in CI and during OpenClaw upgrades.
It intentionally does not modify the canonical `vendor/openclaw` checkout.

### test-local.sh

Full local test pipeline: install, build, unit tests, E2E tests (dev + prod), and pack.

```bash
./scripts/test-local.sh 1.5.8          # full pipeline with version
./scripts/test-local.sh --skip-tests   # build + pack only
```

Steps: `pnpm install` → vendor check → `rebuild-native.sh` → `pnpm build` → `pnpm test` → E2E dev → `electron-builder --dir` → `rebuild-native.sh` → E2E prod.

### publish-release.sh

Promotes a draft GitHub Release (created by CI) to a public release. Run after CI build and local tests pass.

```bash
./scripts/publish-release.sh           # reads version from apps/desktop/package.json
./scripts/publish-release.sh 1.5.8     # explicit version
```

Requires: `gh` CLI authenticated, draft release exists on GitHub, and
`apps/desktop/changelog.json` contains an entry for the release version.

## Verification & Auditing

### audit-provider-sync.mjs

Audits provider/model sync between RivonClaw and vendor. Compares the pi-ai vendor catalog, OpenClaw's `resolveImplicitProviders`, and RivonClaw's `ALL_PROVIDERS` to detect invisible providers or new upstream additions. Used by the `update-vendor` skill (Step 7).

```bash
node scripts/audit-provider-sync.mjs   # exit 0 = no gaps, exit 1 = critical gaps
```

## Developer Utilities

### reset-user-data.sh

Wipes all RivonClaw + OpenClaw user data to simulate fresh onboarding. Cleans SQLite DB, gateway state, logs, workspace, subagents, canvas, and macOS Keychain entries.

```bash
./scripts/reset-user-data.sh           # interactive (asks for confirmation)
./scripts/reset-user-data.sh --force   # skip confirmation
```
