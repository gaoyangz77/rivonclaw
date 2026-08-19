# OpenClaw Patch Stack

This directory is the source of truth for RivonClaw-owned changes applied on
top of the OpenClaw commit pinned by `.openclaw-version`.

## Rules

- Keep one feature or upstream gap per patch.
- Prefer hooks, plugins, config, and RivonClaw-side adaptations over patches.
- Every patch needs a removal condition and a test that fails without it.
- Generate patches with `git format-patch` from a disposable vendor workspace.
- Never leave hand-edited source changes in the canonical `vendor/openclaw`.
- A clean replay is necessary but does not replace a semantic audit on upgrade.

Replay the stack with:

```sh
bash scripts/provision-vendor-patched.sh --target tmp/vendor-patched/openclaw
```

## Current Patches

### 0002 - Per-session tool visibility hook

Adds `before_tool_resolve` after the complete core plus MCP/LSP tool surface is
assembled and before tool-search projection. RivonClaw's capability manager
uses it to hide tools from the LLM per session while `before_tool_call` remains
the enforcement layer.

Removal: upstream exposes a per-session hook that filters the complete
model-visible tool surface.

### 0003 - Raw prompt mode

Adds `promptMode: "raw"`, returning only the caller-provided system prompt.
Customer-service personas use this to avoid OpenClaw identity and runtime text.

Removal: upstream supports a fully caller-owned system prompt mode.

### 0004 - Safe new-account QR login

Prevents a QR login without `accountId` from stopping every existing account
for the channel. Existing-account relogin and takeover behavior is preserved.

Removal: upstream distinguishes new-account login from account relogin.

### 0009 - Desktop runtime guidance

Replaces CLI lifecycle instructions in the agent prompt with RivonClaw's
first-class gateway and session tools.

Removal: upstream exposes host-specific prompt section overrides.

### 0010 - RivonClaw agent branding

Brands agent-visible identity, gateway, update, messaging, and workspace text
as RivonClaw Desktop while retaining OpenClaw references for upstream source,
docs, protocol paths, and the underlying runtime.

Removal: upstream exposes host branding or a post-build prompt transform.

### 0012 - Desktop startup recovery controls

Adds `OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY` and
`OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY`. RivonClaw uses these to avoid
replaying backend-owned customer-service work during desktop startup.

Removal: upstream exposes first-class recovery policy configuration.

### 0014 - RivonClaw remote-media resolver

Resolves remote media through the authenticated local Desktop media-cache
bridge before OpenClaw's guarded fetch. Global routes fall back to the original
URL; CN relay failures are explicit.

Removal: upstream provides a host-owned remote-media URL resolver hook.

### 0015 - Hide media model overrides

Removes per-call `model` fields from image and video tool schemas and ignores
caller-supplied model fields. Model selection remains controlled by configured
RivonClaw profiles.

Removal: upstream provides a policy switch for media model overrides.

### 0016 - Session context-token patching

Exposes `contextTokens` through `sessions.patch` so customer-service sessions
can use a lower effective context cap.

Removal: upstream supports this field through a stable session settings API.

### 0017 - Explicit session checkpoint RPC

Adds `sessions.checkpoint.create`, backed by OpenClaw's current transcript-leaf
checkpoint store. RivonClaw records a stable boundary before customer-service
dispatch and supplies a caller-owned checkpoint id.

Removal: upstream exposes an equivalent explicit checkpoint API.

### 0019 - Image prompt worker process

Runs the heavy built-in image tool prompt path in a child process, with a
main-process fallback. Runtime setup occurs inside the worker so cold startup
does not consume the provider request timeout budget.

Removal: upstream provides equivalent worker-backed image execution.

### 0023 - Feishu task lifetime after queue eviction

Bounds only Feishu's per-chat ordering chain after five minutes while returning
the original task promise to the receiver. The streaming card therefore stays
attached to a still-running agent retry without blocking later chat messages.

Removal: upstream independently bounds ordering without resolving the original
caller-facing task.

### 0027 - Preserve failed Feishu quote context

Retries transient and rate-limited quoted-message reads, makes terminal fetch
failures diagnostic instead of collapsing them to `null`, and passes an
explicit unavailable-quote marker to the agent so it cannot mistake the
employee's reply for complete context. Successfully fetched quotes retain their
existing behavior.

Removal: upstream retries quoted-message reads, surfaces diagnostic failures,
and preserves an explicit unavailable-quote marker in agent context.

### 0028 - Feishu business form cards

Allows trusted Desktop Gateway clients to send raw Schema 2.0 cards and routes
namespaced form callbacks through OpenClaw's interactive-handler registry. Form
values and callback context are preserved, policy checks fail closed, and
claimed business callbacks never become synthetic agent messages.

Removal: upstream bundled Feishu supports trusted raw form-card sends and
synchronous, policy-aware plugin interactive dispatch with complete form data.

### 0029 - Compaction-failure lifecycle reset

Resets the durable SQLite lifecycle after an unrecoverable automatic compaction
or context-overflow failure. The failed transcript remains available, while the
next user turn no longer re-enters the same broken context. If lifecycle reset
is unavailable, OpenClaw retains its upstream preserved-session behavior.

Removal: upstream provides equivalent bounded lifecycle recovery that preserves
the failed transcript without repeatedly routing later turns into it.

### 0030 - Per-run silent completion through Agent RPC

Exposes OpenClaw's existing `allowEmptyAssistantReplyAsSilent` option through
the Gateway Agent RPC and command runner. RivonClaw enables it only for normal
customer-service dispatches, so a clean empty assistant turn can be acknowledged
without changing Main, Affiliate, or summary-agent behavior.

Removal: upstream forwards `allowEmptyAssistantReplyAsSilent` through the Agent
RPC, or provides an equivalent per-run silent-completion option.

### 0032 - Expose embedded-host state migrations

Exports OpenClaw's existing `runStartupMigrations`, workspace detector, and
workspace migrator through the stable `plugin-sdk/node-host` boundary.
RivonClaw Desktop starts an embedded Gateway without the OpenClaw node-host or
Doctor flow, so it must invoke the same official device-auth, device-identity,
exec-approval, and configured-workspace migrations before connecting.

Removal: OpenClaw exposes both migration surfaces from a stable public runtime,
or RivonClaw starts Gateway through a host flow that invokes them itself.

### 0033 - Avoid legacy context-engine self-degradation

Keeps OpenClaw's baseline `legacy` context engine selected when it is already
the configured engine and fallback. Without this guard, normal transcript-host
turns can emit a misleading `legacy` to `legacy` degradation warning because
the compatibility engine intentionally delegates durable transcript ownership
to `SessionManager`.

This is the minimal source fix from upstream commit
`b550c140c7ee21a8a297d089f09be84e9e4b2541` (PR `#120722`).

Removal: the pinned OpenClaw includes upstream commit
`b550c140c7ee21a8a297d089f09be84e9e4b2541` / PR `#120722`.

### 0034 - Feishu websocket liveness timeout

Raises the Feishu long-connection ping timeout from upstream's 3s to 60s. The
Lark SDK terminates the socket unless an inbound frame arrives within that
window of each ping. Because the deadline is measured inside the gateway's
event loop, any stall exceeds it regardless of link quality: a desktop host
running concurrent CS agents was measured with a median event-loop delay of
9.9s and a peak of 22.9s while its round trip to open.feishu.cn was ~75ms. Each
false termination blinds the connection for a 0-30s reconnect nonce plus 120s
between retries, during which Feishu has no online long-connection consumer and
interactive card callbacks fail with "target callback service is offline". 60s
clears the measured stalls and still detects a genuinely half-open socket well
inside one ~120s ping cycle.

Removal: upstream makes the Feishu websocket ping timeout configurable, or
raises it above the range a gateway event-loop stall can cross.

## Dropped In 1609ae9b624

- `0007`: startup model prewarm now publishes the configured static runtime
  snapshots directly, without the old synchronous provider discovery. Keeping
  the deferred patch would move required model publication after chat metadata
  refresh and make Gateway startup fail with an unavailable metadata owner.
- `0031`: OpenClaw now contains commit
  `718e9c88204772c496e8f625cd63be8106cfa106` (PR `#116610`), which ignores
  wildcard route bindings and invalid account candidates during legacy pairing
  migration.

## Dropped In v2026.6.11

- `0005`: OpenClaw now owns system prompts through
  `AgentSession.setBaseSystemPrompt()` and reapplies them through the runner.
- `0006`: upstream proxy/fetch handling now preserves multipart FormData across
  dispatcher realms (`b9c23547ee` and follow-up normalization).
- `0008`: the Pi registry validation path was replaced by OpenClaw's internal
  agent model registry, so the synthetic API-key shim no longer applies.
- `0013`: plugin skill publishing now uses Windows junctions natively and has
  broader generated-entry cleanup tests.
- `0020`: Feishu CardKit lifecycle and full-content preservation fixes
  `f436b4310a` and `1f1ce8a1fe` are included.
- `0021`: full quoted-card reads from `1db8ab3734221925ffe3af06a73d710fe8fdfdce`
  are included.
- `0024`: buffer-verified ZIP support from `d6881962a3` is included.
- `0025`: direct block-media deduplication fixes `9922da3965` and `41000143a1`
  are included.

Earlier dropped patches remain documented in git history.

## Dropped In v2026.7.2-beta.7

- `0011`: upstream now pins channel registries independently from active and
  session-extension registries, with regression coverage for scoped tool
  discovery churn.
- `0018`: upstream now pins the startup session-extension registry and covers
  `sessions.pluginPatch` across later active-registry churn.
- `0022`: upstream commit `55fa22b482a7c6b8163f47590047c34b0dcd7382`
  (OpenClaw #101392) is included.
- `0026`: upstream commits `826c84ea19429ece853d62aba5b674cae90f5824`
  (PR #98835) and `101b601df8acb9139dedc6070081b993dcd5fccb`
  (PR #105754) include identity-only reply-session CAS and bounded,
  abort-aware initialization retries.
