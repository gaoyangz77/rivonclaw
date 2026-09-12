# OpenClaw Upstream Watchlist

This is RivonClaw's vendor-upgrade decision ledger. It records upstream gaps,
temporary downstream mitigations, and upgrade regressions that must be checked
before choosing a new OpenClaw pin. It is not a changelog and does not replace
`vendor-patches/openclaw/README.md`.

Selected-target audit snapshot:

- Target: `1391f7cd2d40ab5bbcf2f5f831d3a64f520e72d7` (`v2026.9.3`).
- Checked: 2026-09-09, against the locally available tag and commit graph.
  This is not a refreshed `origin/main` snapshot or a release acceptance report.
- Coordinator follow-up on 2026-09-09: fetched `origin/main` at
  `8b3fe2fdb30bfb697640efd1686faac2535a318b` and independently checked the
  remote annotated tag/peeled target. `257b8e0` is still not an ancestor of
  main. The target still has 38 upstream release-only commits. This refresh
  does not change the selected stable pin or imply live-channel acceptance.
- Pristine behavioral proof: retire `0035`, `0039`, and `0041`. Retained
  regression tests: 14 behavior tests and 10 Desktop source-contract checks;
  the initial audit additionally passed 36 upstream process-identity tests.
- Runtime: Node 24.21.0, SQLite 3.53.4, macOS arm64. Windows process probes
  were mocked; no real Windows, packaged startup, or new large-state benchmark
  was run in the retirement audit. Commands and limits: [tests/README.md](tests/README.md).
- Follow-up scale proof is separate: paired 13k built-runtime SDK/migration
  measurements and actual Gateway readiness/paginated RPC runs completed.
  The final v9 Gateway's first 20-row RPC read all 13,000 metadata rows.
  See [benchmark report](tests/BENCHMARK_2026.9.3.md); this is not pristine or
  full production-plugin/packaged acceptance evidence.
- Every other entry below was reconciled by source/ancestry, not newly
  behavior-verified here. Other patch replay and product integration are owned
  by the upgrade coordinator. Earlier v2026.8.1 results remain historical.
- Release provenance: local annotated tag object
  `a69d657b4b74556017f2d0ef98b0c64aeabb3643` peels to the target above.
  Against the upgrade checkout's observed `origin/main`
  `411ea27d9af11ed93e6e48d534cebdae6fd840e8`, the tag has **38 upstream
  release-branch commits** not on main. These are not local patches. The
  independent pristine audit tree has zero commits above the tag and an empty
  tracked diff. SSH tag signature verification was unavailable because Git has
  no configured `gpg.ssh.allowedSignersFile`; the local reference was verified,
  not cryptographic signer trust. No remote-main freshness claim is made.

## Contents

- [How An Agent Must Use This Ledger](#how-an-agent-must-use-this-ledger)
- [Active Operational Gaps](#active-operational-gaps)
- [Active Product Contract Gaps](#active-product-contract-gaps)
- [Upgrade Regression Guardrails](#upgrade-regression-guardrails)
- [Scheduled Check Output](#scheduled-check-output)

### Gateway Planned-Stop Compatibility (P0)

Status: `guardrail`, with a downstream launcher workaround (no vendor patch).
Both v2026.8.1 and v2026.9.3 have a compile-cache respawn wrapper whose two-second
signal watchdog can kill an otherwise orderly Gateway shutdown before its boot
lifecycle record completes. Three such records trigger channel suppression.

Desktop avoids the source wrapper by matching upstream's cache-disabled source
policy; packaged installs retain their prepared cache using
`OPENCLAW_PACKAGED_COMPILE_CACHE_RESPAWNED=1`. Parent-child IPC requests orderly
stop on Windows as well as Unix, with a 30s tree-kill backstop. Keep actual crash
protection enabled. The Desktop quit budget must exceed the Gateway stop budget.

Before changing this workaround, run `scripts/test-gateway-lifecycle.mjs` against
both the built source runtime and final packaged archive. Require a single owned
Gateway PID, completed slow-service cleanup, and clean lifecycle rows after three
consecutive planned restarts. Retire the packaged override only when the new
upstream entrypoint honors external supervision without a short-lived wrapper,
and that exact real-runtime test passes without the override.

## How An Agent Must Use This Ledger

Before recommending an upgrade:

1. Read `.openclaw-version`. For an explicit target, resolve that tag/hash;
   for latest-upstream advice, fetch and record `origin/main` separately.
2. Re-check every `P0` and `P1` entry below. Do not trust this snapshot as
   current state.
3. Verify an explicit commit with `git merge-base --is-ancestor`. When upstream
   squashed or rewrote it, inspect the replacement diff and run the listed
   sentinel without the downstream patch.
4. Prefer the earliest reliable pin that resolves the most important entries.
   Do not recommend latest `main` merely because it is newer.
5. Report newly satisfied entries, still-blocked entries, patches that could be
   retired, upgrade guardrail risk, and the smallest useful candidate pin.
6. Never retire a patch from ancestry or commit-title evidence alone. A pristine
   vendor must pass the corresponding behavior test first.

For an explicit stable release on a divergent release branch, replace the
generic "zero commits ahead of origin/main" cleanliness check with equality to
the selected tag, zero local commits above it, and an empty tracked diff before
replay. Record upstream release-only commits separately from replayed downstream
patch commits. Requiring this v2026.9.3 tag to have zero commits outside main
would reject the actual upstream release, not detect a dirty vendor tree.

Scheduled checks are report-only. They must not update the pin, patch stack, or
entry status automatically.

Statuses:

- `waiting-upstream`: no verified upstream replacement is available.
- `candidate-found`: a candidate exists but is not merged into `main` or is not
  yet behaviorally verified.
- `backported`: RivonClaw carries a specific upstream candidate locally.
- `included-unverified`: the target pin appears to contain the fix but its
  sentinel has not passed on pristine vendor.
- `verified`: pristine vendor passes the stated behavioral scope and the
  workaround can be retired; platform/product guardrails still apply.
- `guardrail`: a permanent upgrade compatibility check, not a patch awaiting a
  particular upstream fix.

Priorities:

- `P0`: customer messaging, Gateway availability, or large-store viability.
- `P1`: important production correctness or a common packaged-runtime failure.
- `P2`: product integration gap with a bounded workaround.
- `P3`: branding or developer-experience customization.

## Active Operational Gaps

Resolved entries stay here as regression obligations. Statuses refer to the
selected target, and verification scope is stated per entry.

### AGENT-DB-MIGRATION-001 - Schema 17 additive session repair

- Priority/status: `P0 verified` (source-runtime migration)
- Symptom: `v2026.8.1` tries to validate canonical schema 17 indexes before
  restoring the additive `session_conversations.route_context_json` column and
  its invalidation trigger. Real pre-v2 databases therefore fail the 17-to-19
  migration before Gateway can start.
- Target result: both `592253ffd1039d877a9ce2cacbde5702176ea297` (#134208)
  and `c893a1f8453191951bce75a8769fc5db8e775d68` (#134272) are ancestors.
  `src/state/openclaw-agent-db-schema.ts` runs additive repair, index repair,
  and validation inside `runSqliteImmediateTransactionSync`, and excludes
  schema 17 from pre-repair integrity validation. Public ensure-schema API is
  unchanged; internal migration now uses generator steps, target schema 19.
- Retirement proof: `tests/schema17-retirement.test.ts` passes three pristine
  SQLite cases with the real stopped-writer maintenance lease and heartbeat
  worker: missing column/trigger/index repair with preserved data and
  idempotence; rejected participant-table drift with unchanged schema, data,
  metadata, and version; interrupted additive DDL rollback then successful retry.
  Patch `0041` is retired; do not duplicate the upstream transaction ordering.
- Follow-up acceptance: the built-runtime Desktop startup migration suite
  passes, including the new same-version readiness checks. Paired 13k-session
  repair tests preserve data and pass idempotence. Windows packaged migration
  and real customer-state acceptance are still required.
  Patch `0032` remains separate: private upstream migration APIs are not stable
  embedded-host exports.

### SESSION-SCALE-001 - SQL-native session catalog queries

- Priority/status: `P0 waiting-upstream`
- Symptom: stores around 10,000+ sessions can still pay catalog-wide
  materialization, cloning, transcript matching, or projection costs during
  broad `sessions.list` and catalog consumers. SQLite row count itself is not
  the problem; work performed above SQLite is.
- Known-key resolution: `1544e2345589cd8e472d44cfc0a6aacd8ad8c2a3` and
  `e19a7694cef6d38140033f798215103dd638fafb` are ancestors. Both Gateway
  helpers in `server-methods/sessions-shared.ts` now pass `exactRead: true`
  and use canonical key resolution. `loadSessionEntriesForTarget` retains
  `clone: false` and accepts `includeStoreChildEntries`; only `sessions.describe`
  opts into direct children, not `sessions.get`. Read-only misses do not create
  a database; the next writer creates the configured agent's database. Explicit
  agent ownership conflicts reject, and internal-effects rows remain hidden.
- Retirement proof: nine tests in `tests/known-key-retirement.test.ts` pass on
  pristine. After canonical handle admission, captured executed SQL uses
  `session_key = ?`, returns at most one row per query, and EXPLAIN reports
  `SEARCH session_nodes USING INDEX sqlite_autoindex_session_nodes_1`.
  No catalog helper or unrelated payload decoding occurs. Missing-store/write,
  aliases, conflicting ownership, hidden rows, and direct-child scope pass.
  Patch `0035` is retired. Cold schema admission is outside the bounded-read
  measurement; this is not a 13,000-row performance benchmark.
- Other mitigation: Desktop avoids unnecessary `sessions.list`, disables
  backend-owned startup recovery, and caps automatic CS runs at four.
- Remaining gap: filtering, source selection, and pagination for broad catalog
  calls must be pushed into indexed SQLite queries. At this tag,
  `src/gateway/server-methods/sessions-read.ts` still calls
  `loadCombinedSessionStoreForGatewayCore` with `projection: "list"` and then
  `listSessionsFromStoreAsync`. `src/gateway/session-utils-list.ts` still sorts
  and slices the materialized catalog in JavaScript. Metadata projection and
  caching improvements are not full filtering/pagination pushdown.
- Upstream lead: proposal `257b8e0` is **not** an ancestor of this tag. No claim
  is made that it merged; the coordinator also confirmed non-ancestry of
  refreshed main `8b3fe2fdb30`. Evaluate any
  successor by actual Gateway RPC SQL and large-state measurements, not a
  commit title or SDK list microbenchmark.
- Historical v2026.8.1 benchmark: a synthetic 13,000-row, 417.7 MiB agent database took
  about 395 ms for a cold exact read, 349 ms for the first exact read on a held
  Gateway handle, 0.35 ms for the next exact read on that validated handle, and
  1.34 s for a full list. This confirms that SQLite and patch `0035` make steady-
  state exact dispatch cheap, while broad catalog reads remain roughly 3,865x
  slower than a warm exact read and still justify SQL-native pushdown.
- New paired built-runtime measurement: Node 24.21.0 / SQLite 3.53.4, identical
  13,000 synthetic payloads, 571.58 MiB old / 572.34 MiB new. Independent SDK
  read median was 444.03 -> 687.77 ms; admitted-handle steady reads were
  0.53 -> 0.57 ms. SDK full listing was 731.94 -> 617.64 ms, **not Gateway
  RPC latency**. First update was 945.96 -> 165.35 ms; later v9 update awaits
  returned in 1.81-2.73 ms, but deferred event-loop delays remained 109-274 ms.
  Do not equate fast await completion with an unblocked Gateway. This measured
  the initial v9 dist, not the coordinator's later final rebuild. Full scope,
  provenance, and commands: [benchmark report](tests/BENCHMARK_2026.9.3.md).
- Final-built Gateway proof: both 13k isolated Gateways reached `/readyz` and
  passed actual websocket `sessions.list(limit: 20)` calls at offsets 0 and 12900. Old -> new readiness was 9355.22 -> 7633.67 ms; first-page latency
  169.56 -> 849.91 ms; first late-page latency 127.24 -> 71.43 ms. Repeated
  pages were 1-7 ms. Native telemetry caught v9's first request selecting
  **13,000 projected metadata rows without a SQL limit**, then 20 exact rows.
  Old first-request telemetry saw an already-populated catalog cache, so this
  is a startup-sequence comparison, not uniformly cold algorithm timing.
  Fast cache hits and bounded row hydration do not retire `SESSION-SCALE-001`.
- Exit test: with at least 13,000 sessions and roughly 550 MB of state, inspect
  SQL/query plans and measure startup, one exact-key dispatch, `sessions.list`
  pagination, idle CPU, memory, and event-loop delay. No operation may scan or
  clone the full catalog when its query is bounded.

### FEISHU-QUEUE-001 - Long Feishu turn lifetime

- Priority/status: `P0 waiting-upstream`
- Symptom: the five-minute per-chat ordering cap can settle the receiver while
  the Agent retry still runs, closing its streaming card and losing the final
  delivery.
- Current mitigation: patch `0023` bounds the ordering chain while returning the
  original task promise.
- Target source: `extensions/feishu/src/sequential-queue.ts` still returns
  `next` from `boundedRun`, whose timeout races `task()`. The five-minute
  caller-settlement gap remains. Retained patch replay and queue/lifecycle
  behavior tests pass on the target; a real overloaded channel remains a gate.
- Exit condition: upstream independently bounds ordering without resolving the
  caller-facing task. Run
  `vendor-feishu-queue-lifecycle.sentinel.test.ts` on pristine vendor.

### FEISHU-WS-001 - Event-loop-safe long connection liveness

- Priority/status: `P0 waiting-upstream`
- Symptom: a 3-second ping deadline measured on the Gateway event loop tears
  down a healthy Feishu socket during CS CPU stalls, causing periods with no
  inbound consumer.
- Current mitigation: patch `0034` raises the deadline to 60 seconds.
- Target source: `extensions/feishu/src/client.ts` still sets `pingTimeout: 3`.
  No equivalent configurable long-connection budget was established here.
- Exit condition: upstream makes the timeout configurable or raises it beyond
  measured event-loop stalls. Test under artificial 20-30 second event-loop
  delay, not only a healthy network.

### MODEL-CATALOG-001 - Prepared catalog generation recovery

- Priority/status: `P0 verified` (metadata/scope/mismatch runtime suites only)
- Symptom: deferred model discovery can reconstruct a different plugin/runtime
  generation, leave the configured owner poisoned, and make later Feishu or
  Chat runs fail before dispatch.
- Resolution: v2026.8.1 includes `3dd18ccc8cedbd1584847ca0e56e4c783243831c`
  (PR `#130481`). Rather than recovering after a mismatch, the worker receives
  and restores the exact Gateway plugin metadata generation, preventing the
  invalid reconstruction in the first place.
- Historical verification: the v2026.8.1 pristine metadata-scope integration matrix passes for
  Gateway, activation, and workspace-free discovery, with both catalog-first
  and auth-refresh-first ordering. Patch `0038` is retired; its replacement
  sentinel guards the transferred-metadata contract.
- Target source: the cited commit is an ancestor, and
  `src/agents/prepared-model-catalog.worker.ts` still restores the supplied
  plugin metadata generation. Keep `0038` retired; the target runtime matrix
  below passed. Real-account channel/auth-refresh soak remains independent.
- Upgrade runtime check: five cases in the metadata, scope, and mismatch
  integration suites passed on the v2026.9.3 replay tree. These source files are
  unchanged from the pristine tag. The cases verify metadata ownership, plugin
  scope isolation, mismatch retirement, queued recovery, and protection of a
  replacement worker. This is not a real-account Feishu/auth-refresh soak test.

### SESSION-COMPACTION-001 - Poisoned lifecycle after failed compaction

- Priority/status: `P1 waiting-upstream`
- Symptom: unrecoverable compaction or context overflow can route later turns
  back into the same broken SQLite lifecycle.
- Current mitigation: patch `0029` rotates the durable lifecycle while keeping
  the failed transcript available.
- Target source: auto-reply `error-handler.ts` and `fallback-settlement.ts`
  still preserve the existing mapping (`preserveSessionMapping: true`).
  Retain the bounded lifecycle reset. Refreshed error-handler, fallback,
  Agent RPC and lifecycle behavior tests pass; live near-limit compaction is
  still an independent acceptance check.
- Exit condition: upstream handles both thrown and payload-based compaction
  failures and a later turn succeeds without manual `/reset`.

### MEMORY-FLUSH-BUDGET-001 - Private maintenance respects the session budget

- Priority/status: `P1 candidate-found`, merged on main but not in v2026.9.3.
- Upstream: `4cfeeeceac0fe6a3d2cd0ec0f79d4d050efb4ac0`, PR #143193,
  issue #143188. Verified ancestry in main `8b3fe2fdb30` and non-ancestry
  in the selected stable tag.
- Source change: pre-compaction private memory maintenance receives the
  foreground session's resolved `contextTokenBudget`. Harness preparation
  preserves a smaller model/owner cap instead of widening maintenance to its
  default model budget. This is distinct from retry timeout and from poisoned
  lifecycle recovery in `SESSION-COMPACTION-001`.
- Current mitigation: none added in this upgrade. Do not silently change the
  user's explicit stable pin or claim disabling memory search fixes this path.
- Acceptance: reproduce a small configured CS context budget and a larger
  native model budget; verify memory flush and compaction both keep the owner
  cap. Re-run the upstream setup and private-transcript cases plus a real
  near-threshold turn before recommending a successor pin/backport.

### FEISHU-DELIVERY-001 - Visible partial delivery custody

- Priority/status: `P1 backported`
- Symptom: a reply already visible in CardKit can remain classified as unknown,
  causing the next turn to receive a false "previous reply could not be
  confirmed" warning.
- Current mitigation: patch `0036` backports
  `1096ca2a708f600386b6efd349823c759e041fcc` and clears old notice debt silently.
- Target result: `1096ca2a708f600386b6efd349823c759e041fcc` is not an
  ancestor. The reply dispatcher has substantially changed partial-preview
  handling, but `pending-delivery-notice.ts` still delivers owed notices.
  Do not infer equivalent visible custody or silent old-debt cleanup from the
  new preview code. Retained patch replay, seven custody cases, pending-notice
  cases, and Desktop sentinels pass. Real streaming delivery is still pending.
- Exit condition: pristine vendor preserves partial custody, emits no false
  warning, and old notice debt has aged out before deleting suppression logic.

### FEISHU-QUOTE-001 - Quoted card content integrity

- Priority/status: `P1 waiting-upstream`
- Symptom: failed quote reads collapse to null and merged-forward interactive
  child cards lose escalation details, so the Agent acts on incomplete context.
- Current mitigation: patch `0027` adds bounded retries, explicit unavailable
  context, diagnostics, and child-card expansion.
- Target source: `extensions/feishu/src/send.ts#getMessageFeishu` still returns
  null on failed reads; `bot.ts` logs quote-fetch errors without supplying an
  explicit unavailable-quote context. The old loss-of-context contract remains.
- Exit condition: pristine vendor passes quote API failure, rate-limit, parse,
  and merged-forward card tests without collapsing context.

### STARTUP-RECOVERY-001 - Host-owned recovery policy

- Priority/status: `P1 waiting-upstream`
- Symptom: upstream startup replay can overwhelm a Desktop whose CS retries are
  already owned by Backend/Airflow, especially with large session stores.
- Current mitigation: patch `0012` exposes disable switches; Desktop sets
  `OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY=1` and
  `OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY=1`.
- Target source: neither disable switch exists in the pristine startup paths.
  `server-runtime-services.ts` still dispatches delivery recovery and delayed
  session recovery; `server-startup-post-attach.ts` schedules those services.
- Exit condition: upstream exposes supported recovery policy configuration or
  makes replay bounded and idempotent for backend-owned work.

### IMAGE-WORKER-001 - Image prompting outside the Gateway loop

- Priority/status: `P1 waiting-upstream`
- Symptom: large/multi-image understanding can block the Gateway event loop and
  consume provider timeout budget during worker setup.
- Current mitigation: patch `0019` runs image prompting in a child process.
- Target source: `src/agents/tools/image-tool.ts` still awaits its local
  `runImagePrompt`; no equivalent worker boundary was established. Retain.
- Exit condition: upstream provides equivalent worker isolation; verify Gateway
  liveness while several CS image requests run concurrently.

### WINDOWS-CLI-001 - Lazy Playwright loading in packaged CLI

- Priority/status: `P1 backported`
- Symptom: eager browser policy/Playwright imports break Windows vendor build or
  CLI registration.
- Current mitigation: patch `0037` backports OpenClaw PR `#127035`, commit
  `b1b2608f8ca9a56d573487c7eae8ecbdfa3aa8cc`.
- Target result: the cited commit is not an ancestor. Browser code moved to
  `extensions/browser`; CLI resize still imports `act-policy.js`, but that
  module now imports only lighter helpers/constants, not Playwright directly.
  The old source shape is not proof of an eager Playwright regression. Retain
  `0037` pending its owner's import-graph and packaged Windows behavior proof;
  this audit authorizes no additional retirement.
- Exit condition: a Windows packaged build and empty-PATH runtime contract pass
  on pristine vendor without eager Playwright loading.

### WINDOWS-CRON-001 - Windows process identity for the cron fence

- Priority/status: `P0 verified` (mocked Windows probes, real receipt store)
- Historical symptom: cron's durable fence required a process creation time,
  but the shared reader returned null on Windows, blocking scheduled and manual
  runs with `cron run cannot acquire a durable fence without process start identity`.
- Target result: `97bc908f8850872b960c36dfb58752f6c3a3b653` is an ancestor.
  Shared `src/shared/pid-alive.ts#getFileLockProcessStartTime(pid, env,
windowsTimeoutMs?)` now resolves Windows creation time through
  `src/infra/windows-process-start.ts`. Both cron claim and stale-owner checks
  use it; no private cron reader is needed. It caches successful self reads
  only, rereads foreign PIDs, and shares a default 10-second budget between
  PowerShell (at most 5 seconds) and WMIC (remaining budget).
- Retirement proof: two pristine real-SQLite receipt tests pass with win32
  platform/probes mocked: null self probe retries, successful identity is
  persisted and cached, a live foreign owner conflicts, and changed creation
  time interrupts the old receipt and permits a new claim. The initial audit
  also passes upstream `src/shared/pid-alive.test.ts` (29) and
  `src/infra/windows-process-start.test.ts` (7). Retire `0039`, but retain the
  adapted Desktop sentinel and `tests/windows-cron-retirement.test.ts`.
- Remaining acceptance: no real Windows was available. Run upstream
  `src/gateway/gateway-cron-process-identity.windows.test.ts`, scheduled cron,
  manual run-now, and packaged empty-PATH startup on Windows. Mocked macOS
  results do not prove PowerShell/WMIC availability on a customer's machine.

### MIDTURN-OVERFLOW-001 - Replay-unsafe turns must still auto-compact

- Priority/status: `P0 included-unverified` (previously verified on v2026.8.1)
- Symptom: a long-lived session that crosses the context budget mid-turn never
  auto-compacts and wedges permanently. Every reply fails with "Agent couldn't
  generate a response. Note: some tool actions may have already been
  executed", `compactions=0`, `replaySafe=no`, and zero
  `[context-overflow-diag]` entries; only a manual `/reset` recovers the
  session. Observed 2026-08-24 on production Feishu CS group sessions at
  ~230k estimated prompt tokens against the 224k budget (8 overflow turns,
  3 sessions).
- Historical cause: upstream `b46181bfc0c` (#122516) fenced replay-unsafe attempts
  out of ALL recovery so a post-tool timeout cannot replay completed tools.
  The fence also swallows overflow recovery for mid-turn precheck overflows,
  which fire BEFORE the provider request is dispatched and whose recovery
  continues the current transcript (`prepareCurrentTranscriptRetry`) without
  replaying any tool. Tool-heavy workloads (TK Copilot: ~90 tools, tool calls
  on nearly every CS turn) make every overflow turn replay-unsafe, so both
  compaction defenses fail together: the per-turn preflight misses because
  failed turns freeze the session's usage facts while its message-only
  estimator sits below threshold, and the overflow recovery that would have
  compacted is fenced off.
- Resolution: v2026.8.1 includes `12e52a1c40e0` (PR `#128970`) and
  `72450920f39d` (PR `#129792`). Recovery now requires settled tool evidence,
  admits the current-transcript precheck overflow path, and keeps the
  unconditional replay-safety fence after overflow recovery.
- Related, unpatched: the preflight estimator scope mismatch (messages-only
  vs provider-anchored totals including system prompt + tool schemas) leaves
  a dead zone roughly `(budget − overhead, threshold)` where preflight never
  compacts; with the v2026.8.1 recovery path the overflow now self-heals inside it,
  so the mismatch is a latent inefficiency rather than an outage. Revisit if
  upstream reworks `runPreflightCompactionIfNeeded` token sourcing.
- Historical verification: v2026.8.1 pristine `run.shared-integration.test.ts` covers settled
  replay-unsafe tools and parked Code Mode work, then finishes without a
  surfaced overflow. Patch `0040` is retired; the Desktop sentinel now guards
  the upstream implementation rather than a patch file.
- Target source: both resolution commits are ancestors. `attempt-recovery.ts`
  still checks settled tool work and current-transcript continuation before
  the unconditional replay fence. Keep `0040` retired, but rerun its ordinary
  tool and parked Code Mode matrix on the target before claiming verification.

### QR-ACCOUNT-001 - New QR login must not stop existing accounts

- Priority/status: `P1 waiting-upstream`
- Symptom: starting a QR login without `accountId` stops every active account of
  that channel before the new QR code is scanned.
- Current mitigation: patch `0004` skips channel stop for new-account login.
- Target source: `src/gateway/server-methods/web.ts` still calls
  `stopChannel(provider.id, accountId)` before login/takeover without requiring
  an account ID. New-account and existing-account behavior still need the patch.
- Exit condition: upstream distinguishes new-account login from relogin and the
  multi-account sentinel remains connected throughout onboarding.

### STATE-MIGRATION-001 - Embedded host migration API

- Priority/status: `P1 waiting-upstream`
- Symptom: embedded Desktop startup bypasses node-host/Doctor migrations for
  legacy device identity and configured non-default workspaces.
- Current mitigation: patch `0032` exports official migration functions through
  `plugin-sdk/node-host`; EasyClaw invokes them before Gateway connect.
- Target source: `src/plugin-sdk/node-host.ts` does not export the required
  startup, workspace, auth-profile, and agent maintenance APIs. Private
  `startup-state-migrations.ts` exists, but is not the host SDK contract.
  The schema-17 upstream repair does not retire `0032`.
- Exit condition: upstream exports stable migration APIs or the supported
  embedded startup path invokes all required migrations itself.

## Active Product Contract Gaps

These are lower-value upgrade drivers. A candidate should not be selected only
to remove one of them, but an upgrade that already resolves a higher-priority
entry should test whether they can also be retired.

| ID                       | Priority/status       | Current mitigation                                                                          | Upstream exit condition                                                     |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `TOOL-VISIBILITY-001`    | `P1 waiting-upstream` | `0002` adds complete-surface `before_tool_resolve`; enforcement remains `before_tool_call`. | Stable per-session model-visible tool filtering hook.                       |
| `PROMPT-RAW-001`         | `P1 waiting-upstream` | `0003` adds fully caller-owned `promptMode: raw` for CS personas.                           | Upstream raw/custom prompt mode suppresses every default section.           |
| `REMOTE-MEDIA-001`       | `P1 waiting-upstream` | `0014` routes blocked remote media through Desktop's authenticated cache.                   | Host-provided remote-media resolver hook.                                   |
| `FEISHU-RAW-CARD-001`    | `P1 waiting-upstream` | `0028` permits trusted `operator.admin` Schema 2.0 `params.card` sends.                     | Official trusted raw-card send with no payload rewrite.                     |
| `MEDIA-MODEL-001`        | `P2 waiting-upstream` | `0015` removes unsafe free-form image/video model overrides.                                | Supported policy switch or safe validation against configured media models. |
| `SESSION-CONTEXT-001`    | `P2 waiting-upstream` | `0016` exposes per-session `contextTokens`.                                                 | Stable session settings API owns the field.                                 |
| `SESSION-CHECKPOINT-001` | `P2 waiting-upstream` | `0017` adds caller-owned checkpoint creation RPC.                                           | Business-neutral checkpoint create/restore API.                             |
| `SILENT-RUN-001`         | `P2 waiting-upstream` | `0030` forwards per-run intentional silent completion through Agent RPC.                    | Equivalent upstream Agent RPC option.                                       |
| `RUNTIME-GUIDANCE-001`   | `P3 waiting-upstream` | `0009` replaces CLI-only guidance.                                                          | Host-specific prompt section override.                                      |
| `RUNTIME-BRANDING-001`   | `P3 waiting-upstream` | `0010` applies RivonClaw agent-facing branding.                                             | Host branding or post-build prompt transform.                               |

Target source reconciliation (all ten remain carried; focused replay proof is
still required from their owners):

- `TOOL-VISIBILITY-001`: `src/plugins/hook-types.ts` and `hooks.ts` still lack
  `before_tool_resolve`; keep `0002`. Tool discovery must not bypass filtering.
- `PROMPT-RAW-001`: `packages/gateway-protocol/src/schema/agent.ts` still accepts only
  `full`, `minimal`, and `none` prompt modes, not a caller-owned `raw` mode.
- `REMOTE-MEDIA-001`: `src/media/fetch.ts` does not supply the authenticated
  RivonClaw cache resolver contract. Retain host routing and explicit CN errors.
- `FEISHU-RAW-CARD-001`: `extensions/feishu/src/channel.ts` parses native card
  JSON from send text. Its `ctx.params.card` support is for **edit**, not the
  trusted `operator.admin` raw **send** API. Generic card support does not
  establish untouched business-form payloads or Backend callback ownership.
- `MEDIA-MODEL-001`: `src/agents/tools/image-tool.ts` conditionally offers a
  model override when the primary model lacks vision, and
  `video-generate-tool.ts` still accepts one. Keep the configured-model policy.
- `SESSION-CONTEXT-001`: `packages/gateway-protocol/src/schema/sessions-patch.ts` has no
  `contextTokens` field. Keep the per-session cap contract and round-trip test.
- `SESSION-CHECKPOINT-001`: Gateway `core-descriptors.ts` does not expose
  `sessions.checkpoint.create`; other checkpoint features are not this explicit
  caller-owned creation API. Verify restore and idempotence after replay.
- `SILENT-RUN-001`: Agent RPC still lacks `allowEmptyAssistantReplyAsSilent`.
  `attempt-execution.ts` computes silence from subagent/announce context rather
  than forwarding this caller option; preserve normal CS-only opt-in behavior.
- `RUNTIME-GUIDANCE-001`: `src/agents/system-prompt.ts` still includes OpenClaw
  control and CLI update fallback guidance. No host override was established.
- `RUNTIME-BRANDING-001`: that prompt still identifies the agent as OpenClaw.
  Retain host branding while preserving upstream identifiers in technical paths.

## Upgrade Regression Guardrails

These are permanent checks learned from prior upgrades. They remain
`guardrail` even after one release passes. None of the full checks in this table
was completed by this scoped retirement audit; do not inherit prior-release
passes or another agent's unreported results. The target-specific disposition
below records what still needs proof.

| ID                     | Regression previously observed                                                                                       | Required fail-fast check                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GUARD-TOOLS-001`      | Core tool IDs changed (`cron` to `automations`) while RunProfiles and static catalogs stayed stale.                  | Regenerate exact tool catalog and create/list/delete an automation from Chat and Feishu.                                                  |
| `GUARD-PLUGINS-001`    | Official functionality moved to external plugins; customer machines lacked npm or a resolvable package.              | Packaged runtime with empty `PATH` loads every configured official plugin, including Groq and Weixin, without spawning a package manager. |
| `GUARD-STATE-001`      | JSON-to-SQLite, device identity, workspace, and main-agent path changes left legacy state behind or blocked startup. | Test fresh plus interrupted legacy migration, 10k+ sessions, configured workspaces, memory, auth, and idempotent restart.                 |
| `GUARD-RECIPIENTS-001` | Feishu account-scoped recipients disappeared until a new inbound message recreated them.                             | Existing recipients are visible immediately after upgrade and remain isolated by account.                                                 |
| `GUARD-FEISHU-CS-001`  | CS card callback behavior regressed to Gateway/Desktop handling or textual fallback receipts.                        | Callback goes directly to Backend; resolved updates the same card green exactly once while Desktop/Gateway is stopped.                    |
| `GUARD-MODELS-001`     | New model IDs lost context-window metadata or prepared catalog ownership, breaking compaction and dispatch.          | Audit every production model, near-limit compaction, configured subsets, and deferred catalog recovery.                                   |
| `GUARD-PACKAGING-001`  | Vendor pruning/cache changes inflated artifacts or removed native/runtime dependencies.                              | Compare artifact size and run the final pruned packaged Gateway with empty `PATH`, target `sqlite-vec`, and clean/cache-hit CI builds.    |
| `GUARD-CHANNELS-001`   | Feishu, Weixin, or Telegram account/routing contracts changed despite source builds passing.                         | Real loader plus one direct round trip per enabled channel; Feishu additionally covers group, streaming, quote, and attachment delivery.  |

Target dispositions (updated with local integration results):

- `GUARD-TOOLS-001`: generated-catalog equality and legacy alias tests passed;
  actual authorized scheduler tool calls for Chat/Feishu remain pending.
  Source retirement tests do not inspect the live model-visible request.
- `GUARD-PLUGINS-001`: the actual macOS app loaded all 21 configured plugins,
  including nine external extensions, with empty PATH and reached `/readyz`.
  Weixin QR RPC registration passed again on the final size-adjusted package.
  Windows/Linux remain gates; shared source dependencies are not runtime proof.
- `GUARD-STATE-001`: 287 migration/startup/config cases passed, including 17
  real-runtime migration cases and eight same-version readiness cases. Paired
  13k built-runtime repair/idempotence and isolated Gateway startup also pass.
  Windows packaged migration and real-account acceptance remain pending.
- `GUARD-RECIPIENTS-001`: synthetic legacy account-scoped recipient migration
  and isolation pass. Real-account UI visibility before inbound recreation
  remains pending.
- `GUARD-FEISHU-CS-001`: pending real Schema 2.0 send/callback and same-card
  resolution with Gateway stopped; new native card parsing is not proof.
- `GUARD-MODELS-001`: catalog generation/audit script tests, 51 provider/config
  cases, 195 Gateway catalog/config cases, five prepared-worker runtime cases,
  and two actual API-key chat requests pass. A missing Desktop-only provider
  seed was fixed. Flagship and near-limit live compaction remain pending.
- `GUARD-PACKAGING-001`: actual macOS packaged native modules and empty-PATH
  startup passed again on the final archive, including validated local cache
  reuse. Unpacked app size is +19.1% against baseline after size corrections;
  installer comparison and Windows/Linux builds remain gates. The WAL gate rejected
  Node 24.13.1's SQLite 3.51.2 during this audit; Node 24.21.0's SQLite 3.53.4
  passed. Verify the **actual shipped runtime's** SQLite version and startup;
  do not bypass that gate or assume host Node proves the Electron/package ABI.
- `GUARD-CHANNELS-001`: real macOS plugin-loader checks pass; pending channel round trips,
  including multi-account QR, Feishu queues/quotes/media, Weixin, and Telegram.
  Mocked cron identity is not a channel smoke test.

## Scheduled Check Output

Use this compact report shape:

```text
Current pin / selected target / upstream main (if refreshed):
Newly satisfied:
Still blocked P0/P1:
Candidate commits and ancestry:
Patches potentially removable (verification still required):
Pristine behavior proof and platform limits:
Upgrade regression risks:
Smallest useful candidate pin:
Recommendation: no-upgrade | evaluate-worktree | upgrade
```

Do not include customer identifiers, raw log paths, tokens, secrets, or message
contents in this ledger or scheduled reports.
