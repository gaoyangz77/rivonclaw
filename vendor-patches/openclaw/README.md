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

### 0007 - Deferred model prewarm

Starts channels before the synchronous provider/model discovery prewarm and
defers prewarm by 15 seconds. This avoids multi-second event-loop starvation on
desktops with many providers.

Removal: provider discovery becomes non-blocking or runs outside the gateway
event loop. Verify channel readiness remains below one second without it.

### 0009 - Desktop runtime guidance

Replaces CLI lifecycle instructions in the agent prompt with RivonClaw's
first-class gateway and session tools.

Removal: upstream exposes host-specific prompt section overrides.

### 0010 - RivonClaw agent branding

Brands agent-visible identity, gateway, update, messaging, and workspace text
as RivonClaw Desktop while retaining OpenClaw references for upstream source,
docs, protocol paths, and the underlying runtime.

Removal: upstream exposes host branding or a post-build prompt transform.

### 0011 - Isolated tool-discovery registry

Keeps a scoped plugin tool-discovery registry on the active surface instead of
replacing the startup-pinned channel registry. This protects proactive channel
outbound adapters when cloud tools are refreshed.

Removal: upstream separates tool discovery from channel adapter ownership.

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

### 0018 - Registry refresh after session plugin patch

Refreshes the runtime plugin registry after `sessions.pluginPatch` changes
session extension state, preventing stale tool and hook visibility.

Removal: upstream invalidates or refreshes this registry natively.

### 0019 - Image prompt worker process

Runs the heavy built-in image tool prompt path in a child process, with a
main-process fallback. Runtime setup occurs inside the worker so cold startup
does not consume the provider request timeout budget.

Removal: upstream provides equivalent worker-backed image execution.

### 0022 - Asynchronous taskkill error handling

Backports OpenClaw #101392 to the new `agent-core` kill-tree owner by attaching
an error listener to the best-effort Windows `taskkill` process.

Removal: delete when the pinned vendor includes upstream commit
`55fa22b482a7c6b8163f47590047c34b0dcd7382` or equivalent behavior.

### 0023 - Feishu task lifetime after queue eviction

Bounds only Feishu's per-chat ordering chain after five minutes while returning
the original task promise to the receiver. The streaming card therefore stays
attached to a still-running agent retry without blocking later chat messages.

Removal: upstream independently bounds ordering without resolving the original
caller-facing task.

### 0026 - Reply-session initialization conflict recovery

Backports OpenClaw commit
`826c84ea19429ece853d62aba5b674cae90f5824` (PR #98835) to compare only
`sessionId` and `sessionFile` during reply initialization while preserving
concurrent non-identity metadata. It also backports
`101b601df8acb9139dedc6070081b993dcd5fccb` (PR #105754), which retries true
initialization conflicts up to five times with bounded, abort-aware backoff.

Removal: delete when `.openclaw-version` includes both upstream commits, or an
equivalent implementation with identity-only reply-session CAS and
abort-aware five-attempt outer retry behavior.

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
