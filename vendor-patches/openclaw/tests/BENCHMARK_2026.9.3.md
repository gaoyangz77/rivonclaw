# v2026.9.3 Session-State Benchmark

Measured 2026-09-09 in isolated `tmp/` fixtures. This supplements, but does not
replace, the pristine retirement tests described in [README.md](README.md).

## Scope And Provenance

- Both comparison processes used `/tmp/node-v24.21.0-darwin-arm64/bin/node`:
  Node 24.21.0, SQLite 3.53.4, macOS arm64. Runs were sequential after the
  coordinator permitted the benchmark. This is one paired run on a shared
  14-logical-CPU host, not a controlled multi-run statistical study.
- Old built runtime: `tmp/vendor-baseline-v2026.8.1`; source HEAD reported
  `ea806575e6450e4d1efdfc72c19f04be982a1b9b`. Preserved dist includes
  downstream host SDK exports, so it must not be described as pristine.
- New built runtime: the initial v2026.9.3 `vendor/openclaw/dist`; source HEAD
  at SDK measurement was `ffe06a0ffac72bdda6ac52f7d3daf233e4c444e1`, including
  the coordinator's replay. SDK entrypoint hashes and modification times were
  unchanged across each run and are recorded in the JSON. Source HEAD alone
  does not prove that every built chunk matches source. The coordinator later
  rebuilt patch fixes; this is not qualification of that final artifact.
- Each fixture contains 13,000 nodes/windows and the same 43,011-byte synthetic
  skill prompt per entry (SHA-256
  `9404d8029251c75bd1d42b1d2bf40d2a050a01000d4d7922b3fee56e4c0fd389`).
  Database sizes are 571.58 MiB old and 572.34 MiB new. Raw SQL seeding is
  outside measurement; these are not real customer transcripts.
- `tmp/session-scale-baseline.json` remains the original Node 24.15 baseline.
  It is historical context, not the denominator for this Node 24.21 comparison.

## SDK And Migration Results

Wall times in milliseconds. "Independent" means before writable handle
admission, including fresh read-only connection validation; it does not mean
an OS-cold disk cache. "Held" means reuse of the process-held canonical handle,
verified through `withOpenClawAgentDatabaseReadOnly` identity equality.

| Measurement                                    | v2026.8.1 | v2026.9.3 |
| ---------------------------------------------- | --------: | --------: |
| First independent exact read                   |    439.81 |    612.19 |
| Independent exact reads, median of 5           |    444.03 |    687.77 |
| Canonical writable handle admission            |    380.03 |    441.44 |
| First held exact read                          |    367.93 |    738.02 |
| Subsequent held exact reads, median of 5       |      0.53 |      0.57 |
| First SDK update await                         |    945.96 |    165.35 |
| Later SDK update awaits, median of 4           |    766.88 |      2.18 |
| SDK full list, 13,000 returned rows            |    731.94 |    617.64 |
| RSS sampled after SDK full list, MiB           |   2637.20 |    872.14 |
| CPU consumed during a one-second idle wait, ms |      2.07 |      1.51 |
| Schema-17 repair including maintenance lease   |   1866.02 |   1230.30 |
| Repeated maintenance/ensure-schema call        |    647.77 |    382.28 |

Important limits:

- The ~2 ms result is an **SDK update await**, not an RPC or an end-to-end
  responsiveness measurement. The first v9 update awaited 165.35 ms. Its
  observed event-loop maximum was 273.68 ms; later updates still produced
  109.45-239.99 ms delays while deferred work drained. CPU sampled at await
  completion does not include all later deferred work. No zero-stall claim.
- SDK listing is not Gateway `sessions.list`. The direct exact-key SQL probe
  used an index in both fixtures, but that probe is not an observed SDK/RPC
  plan. The separate pristine tests capture actual helper SQL and plans.
- Both large schema-17 fixtures repaired to 19, retained node/window counts,
  aggregate payload length and the selected entry, passed integrity/foreign-key
  checks, and accepted a repeated migration. This synthetic downgrade drops
  the additive route column, trigger, participant table, and canonical index.
  It is not full historical JSON migration, nor does a built-runtime pass
  establish pristine v2026.8.1 behavior.
- Held steady reads remain fast; independent validation is still expensive
  and was slower on v9 in this run. SDK listing/memory and update-await gains
  do not establish complete Gateway catalog pushdown or production viability.

## Gateway RPC Results

A separate actual CLI Gateway process and websocket client were implemented
in `tmp/benchmark-gateway-sessions.mjs`, with a telemetry-only preload in
`tmp/benchmark-gateway-probe.mjs`. This does not invoke handlers directly or
substitute an SDK list for an RPC. Production channels/providers/plugins, cron,
startup replay, and auxiliary browser/canvas services are disabled in isolated
state; this is not a production-channel or packaged-runtime startup check.

After a 32-row harness smoke, measurement paused during final build/DTS writes.
The coordinator then confirmed the final dist was stable and permitted both
13,000-row Gateway runs. Both passed, returned exactly 20 rows per RPC, and
exited cleanly with code 0. New Gateway source HEAD was
`c8bcce125ee44837ddc4a6bb07a305038d306447`; the final Gateway comparison is
distinct from the earlier SDK comparison's initial build. Both still used
Node 24.21.0 / SQLite 3.53.4 and their existing migrated 13k fixtures.

| Real Gateway measurement                       |   v2026.8.1 |   v2026.9.3 |
| ---------------------------------------------- | ----------: | ----------: |
| Spawn to successful `/readyz`, ms              |     9355.22 |     7633.67 |
| Websocket hello, ms                            |     1587.14 |      334.54 |
| First `sessions.list`, limit 20 / offset 0, ms |      169.56 |      849.91 |
| Same first page repeated twice, ms             | 1.27 / 2.56 | 1.96 / 7.13 |
| First late page, limit 20 / offset 12900, ms   |      127.24 |       71.43 |
| Same late page repeated, ms                    |        2.49 |        1.32 |
| Main-process RSS after first page, MiB         |     1428.70 |      515.97 |
| Main-process idle CPU over one second, ms      |       41.20 |       40.46 |
| Main-process RSS after idle, MiB               |      749.67 |      447.75 |

**The broad catalog gap is behaviorally confirmed.** During the first v9
20-row RPC, native SQLite telemetry observed a projected
`SELECT ... FROM "session_nodes" ORDER BY "session_key"` with no SQL limit
returning **all 13,000 rows**, followed by 20 `WHERE session_key = ?` reads.
The projection removes `skillsSnapshot` and `systemPromptReport`; it still
materializes the entire metadata catalog. The late page used 20 exact row
reads against that populated metadata cache; repeated pages used cache with
no observed session SQL. This does not establish SQL-native pagination.

The JSON label `firstPageCold` means the first request from this client, not
an empty Gateway catalog cache or a cold OS disk cache. Old Gateway's measured
first request only checked cache generation, so it had already paid catalog
preparation outside this request's telemetry window. Do not claim a precisely
5x intrinsic list algorithm regression from these differently prepared caches.
The observed first-request regression is real for this startup sequence,
despite faster readiness and lower sampled memory. Old `/readyz` also reported
degraded CPU/event-loop health at readiness; new readiness had no comparable
event-loop snapshot, so ready does not mean all startup work has quiesced.

No further benchmark process or dependency on stable dist remains after these
runs. Production plugin/channel startup, packaged pruning/native ABI, real
Windows, and full legacy-state startup remain separate acceptance obligations.

## Artifacts And Commands

All raw state, harnesses, logs, and machine-readable results are under `tmp/`:

- `tmp/benchmark-vendor-sessions.mjs`
- `tmp/session-scale-old-2421-13k.json`
- `tmp/session-scale-v9-2421-13k.json`
- `tmp/session-scale-old-2421-13k/`
- `tmp/session-scale-v9-2421-13k/`
- `tmp/session-scale-gateway-smoke-v9-2421.json` and its `.log`
- `tmp/session-scale-gateway-old-2421-13k.json` and its `.log`
- `tmp/session-scale-gateway-v9-2421-13k.json` and its `.log`

From the repository root, on a calm host with stable built artifacts:

```sh
export NODE=/tmp/node-v24.21.0-darwin-arm64/bin/node
BENCHMARK_SCHEMA17=1 "$NODE" tmp/benchmark-vendor-sessions.mjs \
  tmp/vendor-baseline-v2026.8.1 tmp/session-scale-old-rerun tmp/session-scale-old-rerun.json
BENCHMARK_SCHEMA17=1 "$NODE" tmp/benchmark-vendor-sessions.mjs \
  vendor/openclaw tmp/session-scale-v9-rerun tmp/session-scale-v9-rerun.json
```

The SDK benchmark rejects an existing state directory. Use new paths for each
run; do not overwrite the preserved Node 24.15 baseline. The completed 13k
fixtures can feed the real Gateway benchmark without reseeding:

```sh
"$NODE" tmp/benchmark-gateway-sessions.mjs tmp/vendor-baseline-v2026.8.1 \
  tmp/session-scale-old-2421-13k tmp/session-scale-gateway-old-2421-13k.json
"$NODE" tmp/benchmark-gateway-sessions.mjs vendor/openclaw \
  tmp/session-scale-v9-2421-13k tmp/session-scale-gateway-v9-2421-13k.json
```

Wait until vendor artifact writes and competing heavy builds stop. The Gateway
harness uses ephemeral loopback ports/auth, saves actual main-process SQL row
counts per request, and stops its child before exiting. Its fixture config is
rewritten only under `tmp/`; no canonical vendor file is changed.
