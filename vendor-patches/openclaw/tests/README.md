# Retired Patch Regressions

These EasyClaw-owned tests import an explicitly selected upstream source tree.
They do not require or apply the deleted patches. The Desktop sentinels retain
cheap source-contract checks; this separate suite exercises actual SQLite and
the shared Windows identity call path without starting the full vendor suite.

## Run

From the EasyClaw repository root, select an installed vendor tree and a Node
runtime accepted by that vendor's SQLite safety gate. For the v2026.9.3 audit:

```sh
export OPENCLAW_VENDOR_ROOT="$PWD/tmp/retirement-audit-v2026.9.3-0035-0039-0041/pristine"
export NODE=/tmp/node-v24.21.0-darwin-arm64/bin/node
export VITEST="$PWD/tmp/vendor-20260903-authoring/node_modules/vitest/vitest.mjs"
"$NODE" "$VITEST" run --config vendor-patches/openclaw/tests/vitest.config.ts --reporter=verbose
"$NODE" apps/desktop/node_modules/vitest/vitest.mjs run --root apps/desktop \
  src/gateway/vendor-session-known-key-exact-read.sentinel.test.ts \
  src/gateway/vendor-windows-cron-fence.sentinel.test.ts \
  src/gateway/vendor-schema17-repair.sentinel.test.ts --maxWorkers=1
```

For subsequent upgrades, substitute the selected installed pristine tree and
its Vitest entrypoint. Without `OPENCLAW_VENDOR_ROOT`, tests use canonical
`vendor/openclaw`, never silently prefer a previously patched scratch tree.
Verify the selected tree's HEAD and `git diff --exit-code HEAD` before calling
a result pristine; tests alone do not establish provenance.

The standalone config maps workspace source exports and resolves Vitest from
the selected vendor's dependencies. Those dependencies must be available
before the run. The real maintenance heartbeat worker also needs upstream
workspace packages resolvable by Node/tsx outside Vitest's aliases. Use an
already installed/built tree or isolated scratch-only workspace source links;
do not install into, rewrite, or generate caches in another agent's shared
dependency tree. This suite puts its own Vite cache under EasyClaw `tmp/`.

## Proof Scope

- `known-key-retirement.test.ts`: nine cases across the actual two Gateway
  helpers. Real writer fixtures, observed SQLite statements and query plans,
  no full-catalog helper calls/unrelated payload parsing, canonical aliases,
  explicit ownership conflicts, missing-store read then write, hidden internal
  effects, and opt-in direct children. Handle admission is warmed before SQL
  observation; cold validation and large-state performance are separate checks.
- `windows-cron-retirement.test.ts`: two actual receipt-store transactions on
  macOS with win32 and Windows process probes mocked. The shared identity
  reader is real. Null-probe retry, successful-self-only cache, persisted
  epoch-ms identity, live-owner conflict, and PID reuse are asserted. This is
  not a real Windows or scheduled/manual Gateway execution test.
- `schema17-retirement.test.ts`: three actual schema-17 migration cases using
  the real stopped-writer lease and heartbeat worker. Missing additive objects
  and canonical index repair, preserved data, idempotence, participant drift
  rollback, and fault injection after additive DDL with retry are covered.
  The fixture is synthetic, not a full historical customer database.

At pristine `1391f7cd2d40ab5bbcf2f5f831d3a64f520e72d7`, all 14 behavior
tests and all 10 Desktop source checks passed with Node 24.21.0 / SQLite
3.53.4. The initial isolated audit additionally passed upstream
`src/shared/pid-alive.test.ts` (29) and
`src/infra/windows-process-start.test.ts` (7), for 50 behavioral/helper tests
total. Do not count repeated runs of these same tests as additional coverage.

The existing `packages/gateway/src/vendor/state-migration.test.ts` still
retains the built-runtime host migration regression and accepts the same vendor
root override. Run it after the target dist is ready; source-schema tests do
not replace that proof or the `0032` embedded-host export contract. Real
Windows, large-state startup/RPC performance, and final packaged acceptance
remain independent checks recorded in `../UPSTREAM_WATCHLIST.md`.
