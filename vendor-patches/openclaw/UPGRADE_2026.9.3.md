# OpenClaw v2026.9.3 Upgrade Verification

Status: upgrade implemented; local automated verification and operator channel/CS
smoke checks recorded. Operator approved merging after the shutdown correction.
Outstanding platform/stress checks below are not implied to have passed.

## Scope

- Worktree: `easyclaw-vendor-upgrade`, branch `codex/vendor-openclaw-v2026.9.3`.
- Main repository baseline: `fdaf127794919272aa1398e189793d643e35d68e`.
- Previous vendor: `ea806575e6450e4d1efdfc72c19f04be982a1b9b` (`v2026.8.1`).
- Target vendor: `1391f7cd2d40ab5bbcf2f5f831d3a64f520e72d7` (`v2026.9.3`).
- Automated tests use isolated state and synthetic fixtures. The operator also
  tested their real staging profile and approved main-worktree integration;
  production deployment is not part of this work.

## Baseline

- Existing unpacked macOS arm64 app: 1,098,808 KiB (filesystem allocation).
- Existing packaged Resources: 833,092 KiB. No retained installer baseline.
- Existing Electron: 40.10.6, embedded Node: 24.15.0.
- The first baseline test invocation inherited Node 24.13.1 through PATH;
  vendor correctly rejected its unsafe SQLite version. Re-run with explicit
  Node 24.15.0 PATH, not a weakened SQLite check.
- Four pre-existing `auth-runtime.test.ts` cases had a stale backend client
  mock missing the unknown-sender subscription. The test fixture is updated
  without changing authentication behavior.
- Full baseline pipeline was attempted three times. Build passed. The corrected
  auth mock passes all four tests. File-watcher tests still fail before upgrade
  on this heavily loaded macOS host; no production timeout was weakened.
- Baseline dev E2E reached two passes, then three stale signed-in-shell selector
  failures; 118 cases were not run after the fail-fast limit. These are being
  corrected in test-only helpers. Baseline prod E2E is not verified.
- Synthetic SDK baseline: 13,000 sessions, 571.58 MiB, indexed exact-key query
  plan. Cold exact read 1,080 ms; five subsequent independent reads 469-1,027 ms;
  first update 6,346 ms; following updates 727-1,253 ms; full SDK list 2,063 ms.
  Maximum event-loop delay 6,359 ms. These are synthetic API measurements,
  not real channel latency or a held-handle dispatch benchmark.

## Required Compatibility Checks

- Target requires Node `>=24.16.0 <25 || >=26.1.0`; upgrading the system Node
  alone cannot fix the Electron-hosted Gateway.
- Agent database schema remains 19; shared state schema moves from 15 to 16.
- Preserve all configured workspaces, preset skills, auth, device identities,
  channel recipients, and stopped-writer migration authority.
- Preserve complete-surface tool filtering when permission changes refresh
  retained tool objects mid-turn.
- Reconcile every carried patch; retain Feishu queue/liveness/delivery fixes
  unless pristine behavior tests prove an equivalent upstream replacement.

## Implemented Adaptations

- Electron 42.11.3 supplies Node 24.19.0; development/CI uses Node 24.21.0.
  Electron provisioning is explicit, and packaging verifies the actual target
  executable rather than silently using the host Node runtime.
- `better-sqlite3` 13.0.3 supplies portable N-API prebuilds. The prior V8-based
  bindings abort during statement garbage collection on the newer runtime;
  both Node and Electron GC stress checks and all 70 storage tests now pass.
- Removed retired `messages.suppressToolErrors`, preserved prior session
  visibility/delegation defaults, and marked Desktop as the external supervisor.
- Same-version agent schema readiness is checked using the vendor's read-only
  assertion before entering the stopped-writer maintenance lease.
- Feishu's externalized plugin retains the patched local build and its private
  dependency closure; runtime/archive checks reject host-package-manager repair.
- Updated the tool catalog for `ls`, generated schema/text boundaries and config
  documentation, and reconciled branding/control prompts with the new tools.
- Retired patches 0035, 0039, and 0041 after 50 pristine-vendor tests passed.
  The other 20 patches replay successfully in an independent checkout.
- Rebuilt the generated model catalog from all built plugin manifests, including
  runtime-only provider ownership. The old generator only covered Google and
  depended on the now-absent pi-ai catalog for other providers. Fresh-state
  coverage is audited against the compiled app, not an empty fallback.
- Real chat assertions exposed a pre-existing missing seed for Desktop-only
  API-key providers such as `zhipu`: authentication and default activation could
  succeed while the runtime returned `Unknown model`. Seed only a configured
  product-only provider with no existing definition, on creation and startup;
  preserve vendor-owned/user-authored definitions and existing session models.
  Both real model requests now pass, checking actual greeting/arithmetic text.
- pnpm 12 ignores the previous `npm_config_node_linker` override. Setup and
  packaging now explicitly request a hoisted layout and optional dependencies;
  cached production installs must prove that layout. Plugin dependency closure
  validation follows the frozen lockfile, including upstream overrides and the
  multi-document pnpm lock format.
- Updated stale E2E navigation, tabs, toggles, menus, and model activation setup
  to the existing product UI/API. No production UI was changed to satisfy tests.
- Packaged official plugin staging now ships compiled JavaScript. Desktop's
  extraction cache check must require that entry, not the old TypeScript source;
  otherwise valid runtime caches are deleted repeatedly. Three new filesystem
  tests cover fresh extraction, cache reuse, and rejecting an incomplete cache.
- New plugin dependency diagnostics also inspect external plugin manifests.
  Packaged manifests now remove only reviewed bundled/copied dependencies,
  validate emitted imports, and ship actual external dependencies (including
  Weixin QR/audio and the cloud-tools PDF native dependency). Source manifests
  remain suitable for development; missing/unreviewed imports fail packaging.
  The runtime verifier accepts `--resources` to test all packaged extensions,
  not only the official vendor plugins.
- Preserve compiled `.cjs`/`.mjs` plugin entrypoints and sidecars before the
  generic symlink pruning step. The packaged test run exposed missing Teams
  entries even when that plugin was not enabled. All retained plugin manifests
  now have their declared entries checked before packaging/cache reuse.
- Remove validated private source maps and hardlink byte-identical dependency
  files between the two copies of each selected plugin. Private dependency
  paths and conflicting versions stay intact. Archive creation excludes macOS
  AppleDouble files; Windows/Linux copying re-establishes sharing only inside
  the destination package. Existing CI payload limits are not increased.
- E2E now also isolates HOME and platform configuration directories, and seeds
  its own CLI bin in PATH. Before this correction the first packaged test run
  overwrote the operator's `~/.local/bin/openclaw` shim with a temporary test
  path. No original shim backup was available; restoration destination has
  been requested from the operator. Real session/config databases were not
  used by that test. Two isolated-HOME dev smoke tests passed.

## Preliminary Performance Comparison

The same synthetic 13,000-session payload (about 572 MiB), Node 24.21.0 and
machine were used for both builds. These are SDK measurements, not Feishu
latencies, and the host was not otherwise idle.

| Operation | v2026.8.1 | v2026.9.3 |
| --- | --- | --- |
| Repeated held-handle exact read | 0.39-0.62 ms | 0.51-0.99 ms |
| First foreground update | 946 ms | 165 ms |
| Subsequent foreground update | 512-1,370 ms | 1.81-2.73 ms |
| Full SDK list | 732 ms | 618 ms |
| Synthetic schema-17 repair | 1,866 ms | 1,230 ms |

Deferred work still produced 109-274 ms event-loop delays near the new update
operations. Independent reads with fresh handle validation did not improve.
Both migration runs preserved all fixture data and were idempotent. Full SDK
listing is not the `sessions.list` Gateway RPC or SQL pagination pushdown.
Raw results: `tmp/session-scale-{old,v9}-2421-13k.json`.

A separate real Gateway/RPC comparison on the same 13k fixtures measured
startup to ready at 9.36 s old / 7.63 s new, and RSS after the first list at
1,429 MiB old / 516 MiB new. The first `sessions.list(limit:20)` took 170 ms
old / 850 ms new; their catalog caches were prepared at different startup
stages, so this is not an intrinsic fivefold algorithm regression. SQL tracing
confirmed that v9 still reads all 13,000 projected metadata rows before exact
page reads. Full SQL pagination remains unresolved. Detailed measurements and
limits are in [the benchmark report](tests/BENCHMARK_2026.9.3.md).

## Acceptance Matrix

| Check | Result |
| --- | --- |
| Baseline build, unit, dev/prod E2E | Build passed; baseline unit/dev failures recorded above; prod not verified |
| Patch replay in independent workspace | Passed: 20 patches; `tmp/vendor-patched/openclaw` |
| Pristine tests for retired patches | Passed: 50 tests for 0035/0039/0041 |
| Generated schema, tool catalog, config reference | Passed; regenerated again against final build |
| Full build, unit tests, Desktop typecheck | Final root build: 24/24; typecheck passed. Unit: all except 3 pre-existing macOS file-watcher cases pass across full run plus focused retry; see notes below |
| Dev and packaged prod E2E | Dev: 124 distinct cases passed. Packaged: 123 distinct cases passed; one pre-existing dev-only deterministic-captcha case skipped. Results include focused reruns, not a single clean first pass |
| Fresh and legacy state migrations, interrupted retry | Passed: 287 related tests, including 17 real-runtime migration cases and 8 readiness cases |
| 13,000-session synthetic performance comparison | Passed SDK/migration and real Gateway/RPC runs; broad catalog scan remains |
| Configured model request and compaction budget | Two real API-key chat requests passed; 51 provider/config tests and 195 Gateway catalog/config tests passed. Flagship/near-threshold live compaction still pending |
| Prepared model catalog mismatch recovery | Five upstream runtime tests passed: metadata ownership, scope isolation, and three mismatch/replacement cases |
| Plugin runtime loader and empty-PATH packaged startup | Passed with the actual macOS app: 21 plugins, including all 9 external extensions, loaded; Weixin QR RPCs registered; `/readyz` succeeded; no package-manager repair |
| Feishu message/stream/quote/attachment/automation | Operator confirmed basic reply; advanced attachment/automation matrix remains pending |
| Backend CS card callback and exactly-once recovery | Operator confirmed CS reply, escalation and resolved-card submission; outage/exactly-once stress remains pending |
| Weixin and Telegram round trips | Operator confirmed both |
| Packaged artifact size comparison | macOS measured below; +19.1% unpacked app versus baseline. No retained installer for comparison |
| Windows native runtime and clean/cache-hit CI | Pending |

Any unavailable live or platform-specific check remains an explicit release
gate, not a pass inferred from unit tests.

## Final macOS Package

- Unsigned arm64 app: `apps/desktop/release/mac-arm64/TK Copilot.app`.
- Final runtime archive: `69be97d981b8`, 875,775,488 bytes (835.2 MiB), down
  from the initial upgraded 1,011.7 MiB archive after removing redundant payload.
- Unpacked app: 1,308,148 KiB versus baseline 1,098,808 KiB (+19.1%).
  Resources: 1,015,396 KiB versus 833,092 KiB (+21.9%). This is not an installer
  comparison, and the app is still larger than the old vendor build.
- Mirrored private plugin dependency sharing eliminates 104.1 MiB of identical
  file bytes. Logical runtime files total 837.3 MiB, or 733.2 MiB counting
  hardlinked content once. The remaining plugin closures and new runtime must
  remain loadable; no optional-plugin blanket deletion or CI cap increase was
  used to hide size growth. Target-platform installer size remains a gate.
- Both archive-only and actual-app Resources contracts passed after the final
  pruning changes. Actual Electron 42.11.3 / Node 24.19.0 / SQLite 3.53.3
  loaded all 21 configured plugins and reached `/readyz` with empty PATH.
- A second prune invocation took the validated cache-hit path. This is local
  cache evidence, not a claim that Windows/Linux GitHub CI was run.
- Post-pack better-sqlite3 bindings and statement-GC stress passed again on
  Node 24.21.0 and Electron 42.11.3.
- Canonical vendor checkout is clean on `main` at the exact release hash;
  ignored compiled patched output and archive are retained. An independent
  final replay applied all 20 patches. The release branch's 38 commits outside
  upstream main are official ancestry, not local vendor modifications.

## Unit Test Evidence

`scripts/test-local.sh` was attempted end to end. Install, vendor provisioning,
native setup and build passed. The unit stage stopped the pipeline; remaining
stages are executed explicitly rather than pretending that the script passed.

The final continued monorepo test run completed every package. Desktop passed
1,363 cases with three pre-existing skips and one 5-second media-read timeout
under concurrent upstream worker compilation; that exact case passed alone
(1.12 seconds). Gateway passed 415 cases, skipped one, and failed the same three
`skills/skill-reload.test.ts` native file-watcher cases seen before upgrading.
Panel passed all 1,059 cases; the other packages passed. Earlier fresh-profile
migration timeout and an obsolete install-command string sentinel were each
diagnosed and passed on rerun. No watcher assertions or production timeouts
were weakened.

Additional focused checks: 287 migration/startup/config cases; 50 pristine patch
retirement cases; 13 catalog-generation/audit script cases; 18 proxy integration
cases using a local trusted CA; extension dependency and external-import checks.
The full monorepo run is therefore **not unconditionally green** on this host.

The dev E2E suite covers all 124 distinct cases. Failed-only reruns corrected
stale navigation, shop-row/modal, tabs and switches. A former skill-download
test returned early on a server 404 and falsely passed; it now selects an
actual staging marketplace entry and requires installation, disk presence and
deletion. That strengthened case and both strict real model replies passed.
Post-pack native SQLite/GC verification passed again under Node and Electron.

Packaging-specific checks passed 108 cases across 11 files. The subsequent
source-map fix for both runtime roots passed 28 focused size/staging/CI cases.
The first packaged suite exposed the real extraction-cache entry mismatch;
after that fix, a second run passed 100 cases, hit five Gateway connection
wait timeouts and one model-activation total timeout, and was stopped with two
cases interrupted and 16 unrun. Those 24 cases are rerun against the final
package with one worker and unchanged timeouts/assertions. That final run
passed 25 cases (23 remaining applicable cases plus two repeated real chats),
with the pre-existing dev-only deterministic-captcha case skipped, exit 0.
All six earlier failures passed; the suite therefore covers 123 passing
packaged cases, not 124. Dev covers all 124, including captcha. A concurrent-load
explanation alone is not accepted as proof that a failure is harmless.

Final logs (local machine):

- `/tmp/rivonclaw-v9-prod-e2e-round2.log`: 100 passed before final packaging.
- `/tmp/rivonclaw-v9-prod-e2e-final-remaining.log`: 25 passed, one intended skip.
- `/tmp/rivonclaw-v9-pack-handoff-final.log`: final archive/app build and both
  runtime contracts passed, including 21 actual packaged plugins.
- `/tmp/rivonclaw-v9-cache-hit-verified.log`: validated prune cache reuse.
- `/tmp/rivonclaw-v9-independent-replay-final.log`: 20-patch final replay.
- `/tmp/rivonclaw-v9-native-postpack-final.log`: Node/Electron SQLite GC checks.
- `/tmp/rivonclaw-v9-typecheck-handoff-final.log`: final Desktop typecheck, exit 0.

The corrected isolated-HOME test runs did not modify the operator's CLI shim
again. Production deployment is outside this handoff.

## Manual Acceptance and Shutdown Correction (2026-09-10 UTC)

- The operator confirmed Chat/tools, Feishu, Telegram and Weixin replies, and
  TikTok CS reply/escalation/resolve after renewing the staging test account's
  expired CS subscription. Relay telemetry proved the original CS message was
  rejected by staging with `PAYMENT_REQUIRED` before Desktop dispatch; this
  was not a vendor-channel failure. No billing bypass was added.
- The crash-loop breaker already exists in v2026.8.1. Three uncompleted boots
  inside five minutes suppress automatic channel start, while Chat remains
  available. The observed recovery at 03:46:26 UTC explains delayed channel
  replies; it is not a justification for disabling the breaker.
- A real isolated Gateway with a three-second stop service reproduced a
  planned stop killed at 2.06 seconds, exit 1, and an uncompleted boot row.
  `openclaw.mjs`'s cache-respawn wrapper owns that two-second kill timer.
- Desktop now avoids that extra supervisor: source checkout caches are disabled
  before spawn, matching upstream policy; packaged caches remain seeded/enabled
  and explicitly preselected. The packaged-respawn environment contract is
  guarded by a real-runtime test, not only a source-string assertion.
- Private parent-child IPC invokes the runtime's SIGTERM handler on all
  platforms, including Windows where an OS kill previously skipped cleanup.
  The launcher allows 30 seconds before tree termination, coalesces duplicate
  stop requests, and queues an early IPC stop until runtime handlers register.
  Desktop's outer quit budget is 45 seconds and Gateway shutdown starts before
  telemetry flushing. The breaker and lifecycle SQLite records are not patched
  or manually cleared.
- `scripts/test-gateway-lifecycle.mjs` passed on the source checkout and on the
  actual final macOS archive, using Electron 42.11.3. Each run performs three
  starts/stops with 3s/6s/3s service cleanup: no wrapper PID, all services finished,
  all processes exited 0, and every boot row was `clean_stop`. Observed stops:
  source 3.14/6.14/3.16s; packaged 3.23/6.15/3.12s. Windows IPC selection and
  force-kill backstop have unit coverage, not a live Windows run.
- Main's `78e7ea4a` CS queue fix was fast-forward merged into the upgrade branch
  before integration checks. Its six files do not overlap the vendor upgrade.
  All 189 focused buffer/bridge/admission/connection tests pass with the new
  vendor; queued work survives bridge replacement, auth change discards it,
  and automatic run admission remains four with paced replay.
- The operator explicitly requested no E2E rerun after merging to main. The
  previously recorded E2E results remain historical; the final handoff requires
  the focused checks, vendor/project rebuild, and main dev startup verification.
