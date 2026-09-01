# OpenClaw Upstream Watchlist

This is RivonClaw's vendor-upgrade decision ledger. It records upstream gaps,
temporary downstream mitigations, and upgrade regressions that must be checked
before choosing a new OpenClaw pin. It is not a changelog and does not replace
`vendor-patches/openclaw/README.md`.

Current verified snapshot:

- RivonClaw candidate pin: `ea806575e6450e4d1efdfc72c19f04be982a1b9b`
  (`v2026.8.1`)
- OpenClaw `origin/main`: `c6a2bcead19e08f706f1b3c6b820f440817117fa`
- Checked: 2026-09-01

## Contents

- [How An Agent Must Use This Ledger](#how-an-agent-must-use-this-ledger)
- [Active Operational Gaps](#active-operational-gaps)
- [Active Product Contract Gaps](#active-product-contract-gaps)
- [Upgrade Regression Guardrails](#upgrade-regression-guardrails)
- [Scheduled Check Output](#scheduled-check-output)

## How An Agent Must Use This Ledger

Before recommending an upgrade:

1. Fetch OpenClaw `origin/main` and read the current `.openclaw-version`.
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

Scheduled checks are report-only. They must not update the pin, patch stack, or
entry status automatically.

Statuses:

- `waiting-upstream`: no verified upstream replacement is available.
- `candidate-found`: a candidate exists but is not merged into `main` or is not
  yet behaviorally verified.
- `backported`: RivonClaw carries a specific upstream candidate locally.
- `included-unverified`: the target pin appears to contain the fix but its
  sentinel has not passed on pristine vendor.
- `verified`: pristine vendor passes and the workaround can be retired.
- `guardrail`: a permanent upgrade compatibility check, not a patch awaiting a
  particular upstream fix.

Priorities:

- `P0`: customer messaging, Gateway availability, or large-store viability.
- `P1`: important production correctness or a common packaged-runtime failure.
- `P2`: product integration gap with a bounded workaround.
- `P3`: branding or developer-experience customization.

## Active Operational Gaps

### AGENT-DB-MIGRATION-001 - Schema 17 additive session repair

- Priority/status: `P0 backported`
- Symptom: `v2026.8.1` tries to validate canonical schema 17 indexes before
  restoring the additive `session_conversations.route_context_json` column and
  its invalidation trigger. Real pre-v2 databases therefore fail the 17-to-19
  migration before Gateway can start.
- Current mitigation: patch `0041` backports upstream PRs `#134208` and
  `#134272`, commits `592253ffd1039d877a9ce2cacbde5702176ea297` and
  `c893a1f8453191951bce75a8769fc5db8e775d68`. The final fix performs additive
  repair and canonical-index validation inside the same migration transaction.
- Snapshot result: both commits are ancestors of current `origin/main` but of
  no stable release up to `v2026.8.1`, so the backport stays required at this
  pin.
- Exit condition: upgrade to a stable pin containing both commits, then run the
  schema 17 product-path regression on pristine vendor. The test must restore
  the missing column, trigger, and transcript index and finish at the current
  agent schema without leaving partial writes after rejected drift.

### SESSION-SCALE-001 - SQL-native session catalog queries

- Priority/status: `P0 waiting-upstream`
- Symptom: stores around 10,000+ sessions can still pay catalog-wide
  materialization, cloning, transcript matching, or projection costs during
  broad `sessions.list` and catalog consumers. SQLite row count itself is not
  the problem; work performed above SQLite is.
- Current mitigation: patch `0035` makes known-key dispatch, compaction, rewind,
  `sessions.describe`, and `sessions.get` use exact indexed reads. Desktop also
  avoids unnecessary `sessions.list`, disables backend-owned startup recovery,
  and caps automatic CS runs at four.
- Remaining gap: filtering, source selection, and pagination for broad catalog
  calls must be pushed into indexed SQLite queries. Patch `0035` intentionally
  does not claim to solve that surface.
- Upstream lead: proposal `257b8e0` is related but was not in `origin/main` at
  the v2026.8.1 verification snapshot and is still not an ancestor of current
  `origin/main`; it exists only on `origin/steipete/session-list-pushdown`.
  v2026.8.1 takes several lower-risk incremental paths, and post-release commit
  `f9472ce9ca4` reduces listing-cache memory, but both the release and current
  `origin/main` still load the complete session store before Gateway-side
  filtering, ordering, and limiting. Newer incremental candidates include `870f936851f`,
  `0961247d943`, `17d1204b760`, `877ab6b0b2e`, `9d33b0b7275`,
  `3ae680f7143`, and `5248c2fac7c`; none may be treated as a complete replacement
  without the large-store benchmark.
- v2026.8.1 benchmark: a synthetic 13,000-row, 417.7 MiB agent database took
  about 395 ms for a cold exact read, 349 ms for the first exact read on a held
  Gateway handle, 0.35 ms for the next exact read on that validated handle, and
  1.34 s for a full list. This confirms that SQLite and patch `0035` make steady-
  state exact dispatch cheap, while broad catalog reads remain roughly 3,865x
  slower than a warm exact read and still justify SQL-native pushdown.
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
- Exit condition: upstream independently bounds ordering without resolving the
  caller-facing task. Run
  `vendor-feishu-queue-lifecycle.sentinel.test.ts` on pristine vendor.

### FEISHU-WS-001 - Event-loop-safe long connection liveness

- Priority/status: `P0 waiting-upstream`
- Symptom: a 3-second ping deadline measured on the Gateway event loop tears
  down a healthy Feishu socket during CS CPU stalls, causing periods with no
  inbound consumer.
- Current mitigation: patch `0034` raises the deadline to 60 seconds.
- Exit condition: upstream makes the timeout configurable or raises it beyond
  measured event-loop stalls. Test under artificial 20-30 second event-loop
  delay, not only a healthy network.

### MODEL-CATALOG-001 - Prepared catalog generation recovery

- Priority/status: `P0 verified`
- Symptom: deferred model discovery can reconstruct a different plugin/runtime
  generation, leave the configured owner poisoned, and make later Feishu or
  Chat runs fail before dispatch.
- Resolution: v2026.8.1 includes `3dd18ccc8cedbd1584847ca0e56e4c783243831c`
  (PR `#130481`). Rather than recovering after a mismatch, the worker receives
  and restores the exact Gateway plugin metadata generation, preventing the
  invalid reconstruction in the first place.
- Verification: the pristine metadata-scope integration matrix passes for
  Gateway, activation, and workspace-free discovery, with both catalog-first
  and auth-refresh-first ordering. Patch `0038` is retired; its replacement
  sentinel guards the transferred-metadata contract.

### SESSION-COMPACTION-001 - Poisoned lifecycle after failed compaction

- Priority/status: `P1 waiting-upstream`
- Symptom: unrecoverable compaction or context overflow can route later turns
  back into the same broken SQLite lifecycle.
- Current mitigation: patch `0029` rotates the durable lifecycle while keeping
  the failed transcript available.
- Exit condition: upstream handles both thrown and payload-based compaction
  failures and a later turn succeeds without manual `/reset`.

### FEISHU-DELIVERY-001 - Visible partial delivery custody

- Priority/status: `P1 backported`
- Symptom: a reply already visible in CardKit can remain classified as unknown,
  causing the next turn to receive a false "previous reply could not be
  confirmed" warning.
- Current mitigation: patch `0036` backports
  `1096ca2a708f600386b6efd349823c759e041fcc` and clears old notice debt silently.
- Snapshot result: the cited commit was not an ancestor of `origin/main`.
- Exit condition: pristine vendor preserves partial custody, emits no false
  warning, and old notice debt has aged out before deleting suppression logic.

### FEISHU-QUOTE-001 - Quoted card content integrity

- Priority/status: `P1 waiting-upstream`
- Symptom: failed quote reads collapse to null and merged-forward interactive
  child cards lose escalation details, so the Agent acts on incomplete context.
- Current mitigation: patch `0027` adds bounded retries, explicit unavailable
  context, diagnostics, and child-card expansion.
- Exit condition: pristine vendor passes quote API failure, rate-limit, parse,
  and merged-forward card tests without collapsing context.

### STARTUP-RECOVERY-001 - Host-owned recovery policy

- Priority/status: `P1 waiting-upstream`
- Symptom: upstream startup replay can overwhelm a Desktop whose CS retries are
  already owned by Backend/Airflow, especially with large session stores.
- Current mitigation: patch `0012` exposes disable switches; Desktop sets
  `OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY=1` and
  `OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY=1`.
- Exit condition: upstream exposes supported recovery policy configuration or
  makes replay bounded and idempotent for backend-owned work.

### IMAGE-WORKER-001 - Image prompting outside the Gateway loop

- Priority/status: `P1 waiting-upstream`
- Symptom: large/multi-image understanding can block the Gateway event loop and
  consume provider timeout budget during worker setup.
- Current mitigation: patch `0019` runs image prompting in a child process.
- Exit condition: upstream provides equivalent worker isolation; verify Gateway
  liveness while several CS image requests run concurrently.

### WINDOWS-CLI-001 - Lazy Playwright loading in packaged CLI

- Priority/status: `P1 backported`
- Symptom: eager browser policy/Playwright imports break Windows vendor build or
  CLI registration.
- Current mitigation: patch `0037` backports OpenClaw PR `#127035`, commit
  `b1b2608f8ca9a56d573487c7eae8ecbdfa3aa8cc`.
- Snapshot result: the cited commit was not an ancestor of `origin/main`.
- Exit condition: a Windows packaged build and empty-PATH runtime contract pass
  on pristine vendor without eager Playwright loading.

### WINDOWS-CRON-001 - Windows process identity for the cron fence

- Priority/status: `P0 waiting-upstream`
- Symptom: every cron execution on Windows fails immediately with `cron run
cannot acquire a durable fence without process start identity`. Scheduled
  runs and manual run-now both fail because both enter through the same
  admission claim. macOS and Linux are unaffected.
- Cause: the durable fence added in `d3308e2cfd9` (`fix(cron): fence executions
with durable receipts`, #122948) requires a non-null process start time, but
  `src/shared/pid-alive.ts#getFileLockProcessStartTime` implements Linux procfs
  and macOS `ps` only and returns null on Windows. Upstream already ships
  `src/infra/windows-port-pids.ts#readWindowsProcessStartTimeSync`, and both
  `infra/gateway-lock.ts` and `node-host/node-worker-process-identity.ts`
  already wrap the shared helper with a win32 branch; the cron receipt store
  was missed.
- Current mitigation: patch `0039` gives the cron receipt store its own
  cross-platform reader, used by both the claim and the staleness comparison so
  the persisted and observed owner identities stay in one unit. Fixed at the
  cron call site, not in `shared/pid-alive.ts`, to keep the blast radius off
  file locks, startup migration checkpoints, and stale-lock adjudication.
- Snapshot result: at the `fa62fccb867` pin, `origin/main` was 989 commits ahead
  and contained no commit touching `src/shared/pid-alive.ts` or
  `src/cron/store/run-receipt-store.ts`. Upstream has not fixed this.
- Exit condition: the pin resolves a Windows process start time for the cron
  fence, either through `getFileLockProcessStartTime` itself or an equivalent
  cron-side reader. Verify on pristine vendor by running
  `src/cron/store/run-receipt-store.windows-start-time.test.ts` with the
  platform stubbed to win32; it must acquire a fence rather than throw. Then
  retire patch `0039` and
  `apps/desktop/src/gateway/vendor-windows-cron-fence.sentinel.test.ts`.

### MIDTURN-OVERFLOW-001 - Replay-unsafe turns must still auto-compact

- Priority/status: `P0 verified`
- Symptom: a long-lived session that crosses the context budget mid-turn never
  auto-compacts and wedges permanently. Every reply fails with "Agent couldn't
  generate a response. Note: some tool actions may have already been
  executed", `compactions=0`, `replaySafe=no`, and zero
  `[context-overflow-diag]` entries; only a manual `/reset` recovers the
  session. Observed 2026-08-24 on production Feishu CS group sessions at
  ~230k estimated prompt tokens against the 224k budget (8 overflow turns,
  3 sessions).
- Cause: upstream `b46181bfc0c` (#122516, on main since 2026-08-12, in
  v2026.8.1-beta.2+ but in NO stable release) fences replay-unsafe attempts
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
- Verification: pristine `run.shared-integration.test.ts` covers settled
  replay-unsafe tools and parked Code Mode work, then finishes without a
  surfaced overflow. Patch `0040` is retired; the Desktop sentinel now guards
  the upstream implementation rather than a patch file.

### QR-ACCOUNT-001 - New QR login must not stop existing accounts

- Priority/status: `P1 waiting-upstream`
- Symptom: starting a QR login without `accountId` stops every active account of
  that channel before the new QR code is scanned.
- Current mitigation: patch `0004` skips channel stop for new-account login.
- Exit condition: upstream distinguishes new-account login from relogin and the
  multi-account sentinel remains connected throughout onboarding.

### STATE-MIGRATION-001 - Embedded host migration API

- Priority/status: `P1 waiting-upstream`
- Symptom: embedded Desktop startup bypasses node-host/Doctor migrations for
  legacy device identity and configured non-default workspaces.
- Current mitigation: patch `0032` exports official migration functions through
  `plugin-sdk/node-host`; EasyClaw invokes them before Gateway connect.
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

## Upgrade Regression Guardrails

These are permanent checks learned from prior upgrades. They remain
`guardrail` even after one release passes.

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

## Scheduled Check Output

Use this compact report shape:

```text
Current pin / upstream main:
Newly satisfied:
Still blocked P0/P1:
Candidate commits and ancestry:
Patches potentially removable (verification still required):
Upgrade regression risks:
Smallest useful candidate pin:
Recommendation: no-upgrade | evaluate-worktree | upgrade
```

Do not include customer identifiers, raw log paths, tokens, secrets, or message
contents in this ledger or scheduled reports.
