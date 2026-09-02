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

**The workstation default Node is not necessarily one of them.** At the
`v2026.8.1` pin the range is `>=22.22.3 <23 || >=24.15.0 <25 || >=25.9.0`, and a
default of 24.13.1 fails the preinstall gate before anything is installed. Pick a
satisfying version explicitly rather than assuming the shell default works:

```bash
fnm list                                    # or: nvm ls
export PATH="$(dirname "$(fnm exec --using 24.15.0 -- which node)"):$PATH"
./scripts/setup-vendor.sh --skip-clone
```

An agent worktree that already has a working vendor proves nothing about the
main checkout: each worktree carries its own `vendor/openclaw`, and only the
`.openclaw-version` pin travels with a merge.

#### Vendor git state after provisioning

`setup-vendor.sh` commits the patch stack onto `vendor/openclaw`, which leaves
HEAD ahead of the pin. Two things then behave differently from what that state
suggests:

- `provision-vendor-patched.sh` refuses to run — it requires the checkout to sit
  exactly on the pin, because it builds the patched workspace itself.
- The `update-vendor` skill's `provision-vendor.sh` finishes the job by resetting
  the branch back to the pin (`git checkout -B main <pin>`), leaving pristine
  source next to a patched `dist/`. That is the intended steady state, and it is
  why the vendor sentinel tests read `tmp/vendor-patched/openclaw` first.

That skill script also asserts the checkout is level with `origin/main`. **This
assertion is wrong for a tag pin.** `v2026.8.1` is not an ancestor of upstream
`main`, so the check reports "N commits ahead" on a perfectly valid state. The
pre-commit hook — the thing the assertion exists to satisfy — only requires the
branch to be `main` with a clean tree (`.gitignore` excluded).

### vendor-pnpm.cjs

Resolves the pnpm release pinned by a vendor checkout and prints the absolute
path to its JavaScript CLI entry (`pnpm/bin/pnpm.mjs`), installing it into
`tmp/vendor-pnpm/<version>` on first use. Callers run it as `node <entry> ...`,
so Windows never has to spawn a `.cmd` shim.
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

### setup-pixel-agents.sh

Clones and builds `vendor/pixel-agents` from the commit pinned in
`.pixel-agents-version`, then stages the office renderer into
`apps/desktop/build/office/` (the Panel `publicDir`, so it is served at
`/office/` in both dev and production).

```bash
./scripts/setup-pixel-agents.sh                # clone, build, stage
./scripts/setup-pixel-agents.sh --skip-clone   # rebuild an existing checkout
```

Four vendor patches, in `vendor-patches/pixel-agents/`, applied by the script
the same way `setup-vendor.sh` applies the OpenClaw stack: host-translated
labels (upstream ships no i18n, and the labels drawn over characters are the
only user-visible text inside the office), a kiosk mode with a host-chosen zoom
(the office is looked at, not worked in, so its own toolbar and zoom controls
are hidden), multi-phrasing labels (an idle caption may be a list, spread
across characters and rotated over time, so a room of idle workers does not
wear one identical word), and host-named folders (the department line under a
character is a routing key - the room id - which the host may give a display
name in the viewer's language). Everything else is driven over the message protocol,
so the rest of the source is used exactly as published. A patch added after the
last staging run is not in the served build until the script is run again.

Two build-time additions live in the staged copy, never in the vendor checkout:

- `office-host-shim.js`, which supplies the `acquireVsCodeApi` global its
  `PostMessageTransport` expects (the contract VS Code itself implements) and
  reads the label translations the Panel passes on the iframe URL.
- `office-layout.json` (in `assets/office/`), regenerated by
  `scripts/generate-office-layout.ts`. It draws one desk per admissible run,
  reading the same concurrency constants the admission controllers enforce
  (`packages/core/src/node-utils/agent-concurrency.ts`) so a department can
  never be configured with more concurrency than it has chairs - a mismatch the
  renderer would otherwise absorb silently by seating the overflow in other
  departments. It also declares the office pets, which the renderer spawns and
  wanders on its own; each is placed by `petType`, an index into the pet sprite
  array the extractor below decodes, so the generator asserts that index against
  the same sprite folders rather than trusting the two scripts to agree.
- `scene-assets.json`, written by `scripts/extract-pixel-agents-assets.ts`.
  A production Pixel Agents build tree-shakes away its own browser-side asset
  loader, so the host has to deliver every sprite over the transport; that
  script runs upstream's Node decoders once at build time to produce them. It
  runs them a second time over `assets/office/furniture/`, where furniture that
  is ours rather than upstream's lives - the calligraphy plaques the layout
  hangs on each department's wall - kept outside `vendor/` because that checkout
  is replaced wholesale on every engine upgrade. The directory is in the shape
  upstream's own walkers expect, so the two catalogs simply merge; ids may not
  collide, and unlike upstream's quiet skipping, a plaque that decodes to no
  sprite fails the build.

Both CI workflows and `test-local.sh` run this script before `pnpm run build`,
since the Panel copies its `publicDir` at build time and a later run would not
reach the bundle. In `.github/workflows/`, `vendor/pixel-agents` is cloned by
hand ahead of the caches — a restored `node_modules` would leave the directory
non-empty and `git clone` refuses that — and the `node_modules` and `dist`
caches set `SKIP_PIXEL_AGENTS_INSTALL` / `SKIP_PIXEL_AGENTS_BUILD` on a hit; the
`dist` key covers the patch stack and this script, so a changed patch rebuilds.
`test-local.sh` re-provisions when the checkout is missing, when its HEAD is not
a descendant of the pin, or when the staged `scene-assets.json` is gone.
Staging is verified by `apps/desktop/src/scene/office-renderer.sentinel.test.ts`,
which fails when the served bundle is missing any carried patch's effect, when
the shim is not injected, or when a patch is added without a marker to check it.

The host side lives in `packages/pixel-agents-bridge`, and the renderer-agnostic
scene types it consumes live in `packages/scene-contract`.

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
