# OpenClaw Patch Stack

This directory stores RivonClaw-owned source patches for `vendor/openclaw/`.

The source of truth is the patch stack in this directory, not the live state of
`vendor/openclaw/`. The pinned upstream base remains `.openclaw-version`.

## Scope

Store only source-level OpenClaw changes that are still required during normal
development or runtime.

Do not store:

- packaging-only rewrites that belong in build scripts
- broad refactors for convenience
- "just in case" patches without a current product need

## Rules

- Keep the patch count as low as possible.
- One patch must cover exactly one feature, one fix, or one upstream gap.
- Touch the fewest files that can solve the problem.
- Every patch must come with at least one RivonClaw test that would fail without
  the patch.
- Prefer upstreamable patches. If upstream already fixed the problem, remove the
  local patch instead of carrying it forward.
- If a patch can be replaced by a plugin, extension hook, config override, or
  RivonClaw-side adaptation, prefer that over patching vendor code.

## Format

Patch files should be generated with `git format-patch` from a disposable
patched vendor workspace. Keep them numbered in replay order:

```text
0001-topic.patch
0002-topic.patch
```

Each patch commit message should use this structure:

```text
vendor(openclaw): short imperative summary

Why:
- why RivonClaw still needs this patch

Removal:
- exact upstream condition, PR, or release that lets us drop it

Tests:
- path/to/test-one
- path/to/test-two
```

That commit body is preserved inside the patch file and gives the AI enough
context to judge whether the patch is still correct, still needed, or should be
dropped after an upstream update.

## Replay

Use `scripts/provision-vendor-patched.sh` to create a disposable patched
workspace at `tmp/vendor-patched/openclaw` and replay this patch stack with
`git am --3way`.

After exporting or refreshing a patch file, restore `vendor/openclaw` back to
the pinned upstream commit. Do not leave local vendor commits sitting on the
canonical checkout.

A clean replay is necessary but not sufficient. After replaying patches during a
vendor upgrade, the AI must still inspect whether each patch:

- is still semantically correct
- is still the smallest viable patch
- is still required at all
- still has meaningful test coverage

## Current Patches

### 0002 — `before_tool_resolve` hook for per-session tool filtering

**File:** `0002-vendor-openclaw-add-before_tool_resolve-hook-for-per.patch`

**Why:** OpenClaw resolves the full tool list once at agent startup and does not
support per-session or per-turn filtering. EasyClaw's capability manager
(`extensions/rivonclaw-capability-manager/`, ADR-031) needs to dynamically
show/hide tools based on the current session's `effectiveTools` policy. This
patch adds a `before_tool_resolve` hook that lets plugins intercept tool
resolution and filter the list before it reaches the LLM.

**Removal:** Drop when upstream OpenClaw provides a native tool-filtering hook
or plugin API that supports per-session tool visibility.

### 0003 — `promptMode: "raw"` for custom persona agents

**File:** `0003-vendor-openclaw-add-promptMode-raw-for-custom-person.patch`

**Why:** OpenClaw injects identity ("You are a personal assistant running
inside OpenClaw"), runtime info, safety guidelines, heartbeat tokens, and
documentation links into every system prompt. For EasyClaw's customer-service
agent, which must present a human persona, these sections leak AI identity and
undermine the custom prompt. Even `promptMode: "none"` still injects the
identity line. `promptMode: "raw"` returns only the caller-supplied
`extraSystemPrompt` with zero hardcoded content.

**Change:** Add `"raw"` to `PromptMode` union type and an early return in
`buildAgentSystemPrompt()` that returns `extraSystemPrompt ?? ""` when
`promptMode === "raw"`. Also passes `promptMode` into the `before_prompt_build`
hook context so plugins can skip their own system prompt injections in raw mode.

**Removal:** Drop when upstream OpenClaw adds a native way to fully suppress
all default system prompt sections.

### 0009 — Replace CLI guidance for RivonClaw Desktop

**File:** `0009-vendor-openclaw-replace-cli-guidance-for-rivonclaw-desktop.patch`

**Why:** OpenClaw's default system prompt tells agents to run `openclaw status`
and includes an OpenClaw CLI quick reference. RivonClaw Desktop manages the
gateway lifecycle itself and does not expose a reliable OpenClaw CLI surface to
agents or users, so those prompt sections caused agents to try unavailable CLI
commands. RivonClaw previously carried a prompt-prepend extension to override
that guidance, which left conflicting instructions in the final system prompt.

**Change:** Replace the docs-section CLI diagnostic sentence and OpenClaw CLI
quick reference with RivonClaw Desktop runtime guidance that points agents to
first-class runtime tools.

**Removal:** Drop when upstream OpenClaw supports branded/runtime-specific
prompt sections or a post-build system-prompt transform that lets RivonClaw
remove CLI guidance without patching vendor source.

### 0010 — Brand agent prompt for RivonClaw Desktop

**File:** `0010-vendor-openclaw-brand-agent-prompt-for-rivonclaw-desktop.patch`

**Why:** Patch 0009 removes the CLI quick reference, but the default agent
prompt still identifies the assistant as running inside OpenClaw and labels
user-visible runtime/tooling sections as OpenClaw. RivonClaw embeds OpenClaw as
the underlying gateway/runtime, but agent-facing product identity should be
RivonClaw Desktop to avoid mixed-brand answers when users inspect the prompt.

**Change:** Rebrand agent-visible identity, update headings, tool summaries,
messaging, and workspace-file text to RivonClaw/RivonClaw Desktop. Keep
OpenClaw where it refers to the underlying runtime, upstream docs/source, CLI
command name, or protocol paths such as `/__openclaw__/canvas/...`.

**Removal:** Drop when upstream OpenClaw supports branded/runtime-specific
prompt sections or when RivonClaw can post-process default prompt sections
without patching vendor source.

### 0004 — Skip `stopChannel` for new-account QR logins

**File:** `0004-vendor-openclaw-skip-stopChannel-for-new-account-QR-.patch`

**Why:** OpenClaw's `web.login.start` RPC handler unconditionally calls
`context.stopChannel(provider.id, accountId)` before generating a QR code.
When `accountId` is undefined (new account login), this stops ALL running
accounts for the channel -- killing live WeChat bots the moment the QR code
is displayed, before anyone scans it. EasyClaw supports multiple WeChat
accounts; starting a QR login for a new account must not disconnect existing
accounts.

**Change:** Wrap `stopChannel` in `if (accountId)` so it only fires for
re-login of an existing account, not for new-account logins.

**Removal:** Drop when upstream OpenClaw makes `stopChannel` conditional on
re-login vs new-account login, or adds an option to skip channel stop.

### 0005 — Re-apply system prompt override before LLM call

**File:** `0005-vendor-openclaw-re-apply-system-prompt-override-befo.patch`

**Why:** `pi-coding-agent`'s `AgentSession` internally rebuilds `_baseSystemPrompt`
via `_rebuildSystemPrompt()` during tool refresh, compaction, and extension
lifecycle events. When a gateway session JSONL file already exists (second message
onwards in the same conversation), these internal rebuilds can overwrite the
`_baseSystemPrompt` that `applySystemPromptOverrideToSession` set, causing
`extraSystemPrompt` callers (e.g. EasyClaw CS agents using `promptMode: "raw"`)
to silently lose their custom system prompt.

**Change:** Add a single `applySystemPromptOverrideToSession(activeSession,
systemPromptText)` call in `attempt.ts` immediately before `activeSession.prompt()`,
ensuring the caller's system prompt is always the last one applied before the
LLM call.

**Removal:** Drop when `pi-coding-agent`'s `AgentSession.prompt()` natively
respects external `_baseSystemPrompt` overrides across session reuse, or when
upstream adds a dedicated system-prompt-override API.

### 0006 — Bypass SSRF-guarded fetch for FormData audio transcription

**File:** `0006-vendor-openclaw-bypass-ssrf-guard-for-formdata-audio.patch`

**Why:** OpenClaw's `fetchWithSsrFGuard` routes requests through
`fetchWithRuntimeDispatcher` (bundled `undici.fetch`) whenever any dispatcher
is active. Node's native `FormData` and bundled `undici.fetch` come from
different runtime realms, so undici cannot serialize the multipart boundary
correctly. The server receives a request without a valid
`Content-Type: multipart/form-data` header and returns HTTP 400. This breaks
all OpenAI-compatible audio transcription providers (Groq, OpenAI, Mistral).

Upstream #64766 added `pinDns: false` which disables the pinned DNS
dispatcher, but does not prevent other dispatcher paths (e.g.
`createPolicyDispatcherWithoutPinnedDns` from `dispatcherPolicy`) from
triggering `undici.fetch`.

**Change:** Replace `postTranscriptionRequest()` call in
`transcribeOpenAiCompatibleAudio()` with a direct `globalThis.fetch()` call.
This preserves correct FormData serialization and still routes through the
global `EnvHttpProxyAgent` dispatcher set by EasyClaw's `proxy-setup.cjs`,
so proxy/firewall configurations (including GFW bypass) are honored.

**Upstream issues:**

- openclaw/openclaw#64312 — guarded runtime fetch drops multipart FormData fields
- openclaw/openclaw#64762 — SSRF guard pinned DNS corrupts FormData
- openclaw/openclaw#64766 — incomplete fix (pinDns only)

**Removal:** Drop when upstream openclaw/openclaw#64312 is resolved in a
released version AND verified that FormData multipart encoding works
end-to-end through the SSRF guard without corruption. Test by sending a
voice message via Feishu or Telegram and confirming the agent receives
the transcript text.

### 0007 — Defer `prewarmConfiguredPrimaryModel` to unblock event loop

**File:** `0007-vendor-openclaw-defer-prewarmConfiguredPrimaryModel.patch`

**Why:** `prewarmConfiguredPrimaryModel()` calls `ensureOpenClawModelsJson()`
which runs ~9 seconds of synchronous provider discovery (loading all provider
plugins, running each provider's catalog hook serially, schema validation).
This completely blocks the Node.js event loop. In the vendor's startup sequence,
`prewarmConfiguredPrimaryModel()` runs **before** `startChannels()`, so all
channel connections (webchat, Telegram, WeChat, Feishu) are starved for the
entire duration. With 7+ configured providers, the webchat connection is
delayed by ~9 seconds after gateway READY.

**Change:** Swap the call order so `startChannels()` runs first, then defer
`prewarmConfiguredPrimaryModel()` via `setTimeout(15000)`. The 15-second
delay gives channels enough time to complete probes (each up to 2.5s),
establish monitors, and process initial messages before the synchronous
provider discovery blocks the event loop. Prewarm errors are caught by a
`.catch()` handler and logged as warnings rather than failing channel
startup.

**History:** This patch was previously carried as 0007 in the v2026.4.11 stack,
dropped in commit `e322752` based on warm-cache testing that showed 375ms
sidecars→webchat. Re-added after production logs confirmed the ~9s event loop
block persists with multiple providers configured (7 auth profiles, OpenRouter,
Gemini, Groq, Volcengine, Brave, Perplexity). The warm-cache test was
misleading — the bottleneck is CPU-bound provider discovery, not V8 compilation.

**Upstream issues:**

- openclaw/openclaw#62364 — slow startup with multiple providers
- openclaw/openclaw#62051 — worker processes load all plugins

**Removal:** Drop when upstream makes `ensureOpenClawModelsJson` / provider
discovery truly async (yielding the event loop between providers), or moves
prewarm to after channel startup natively, or offloads provider discovery
to a worker thread. Verify by measuring time from "starting channels and
sidecars…" to "webchat connected" in vendor log — should be <1s without
this patch if upstream fixed the blocking.

### 0008 — Pi SDK compatibility shim for auth-mode providers

**File:** `0008-vendor-openclaw-shim-synthetic-apiKey-for-auth-mode-.patch`

**Why:** Pi SDK's `ModelRegistry.validateConfig()` requires `apiKey` for any
provider with models, but OpenClaw legitimately generates providers with
`auth: "token"/"oauth"/"aws-sdk"` and no `apiKey` (e.g. codex OAuth provider).
This causes Pi SDK to reject the ENTIRE models.json, dropping ALL custom models
including correctly configured providers like `rivonclaw-pro`.

**Change:** In `loadModelCatalog()`, between `ensureOpenClawModelsJson` and
`instantiatePiModelRegistry`, add a shim that reads the generated models.json,
injects `apiKey: "__oc_synthetic_<auth_mode>"` for providers that have models
but no apiKey and use a recognized auth mode (token/oauth/aws-sdk), writes the
shimmed config to a temp `models.pi-compat.json`, passes the temp file to
`instantiatePiModelRegistry`, and deletes the temp file after the registry is
instantiated. The shim is narrow -- only qualified auth-mode providers get
synthetic keys, not a blanket bypass.

**Removal:** Drop when Pi SDK accepts `auth: "token"/"oauth"/"aws-sdk"` as
valid alternatives to `apiKey` in `validateConfig`, or when OpenClaw's
models-config generation ensures `apiKey` is always present for providers
with models.

### 0011 — Keep tool discovery off the channel registry

**File:** `0011-vendor-openclaw-keep-tool-discovery-off-channel-registry.patch`

**Why:** RivonClaw cloud tools are loaded through OpenClaw plugin tool
discovery. That path can load a scoped registry containing only tool-owner
plugins, such as `rivonclaw-cloud-tools`, without the configured channel
outbound adapters. OpenClaw was installing that scoped registry as the channel
surface, which could replace the gateway startup channel registry and make
proactive sends fail with `Outbound not configured for channel:
openclaw-weixin` even though the channel had started correctly.

**Change:** `ensureStandalonePluginToolRegistryLoaded()` now installs its
tool-discovery registry on the active surface, not the channel surface. The
startup-pinned channel registry remains responsible for outbound adapter
resolution.

**Tests:**

- `vendor/openclaw/src/plugins/tools.optional.test.ts`
- `apps/desktop/src/gateway/vendor-channel-registry-pin.sentinel.test.ts`

**Removal:** Drop when upstream OpenClaw guarantees plugin tool discovery
cannot replace the startup-pinned channel registry used for outbound delivery,
or when upstream exposes a separate tool-discovery registry surface.

### 0012 — Disable startup recovery for RivonClaw Desktop

**File:** `0012-vendor-openclaw-allow-disabling-startup-recovery.patch`

**Why:** RivonClaw receives customer-service retries from backend/Airflow. When
OpenClaw replays local outbound deliveries and interrupted agent sessions during
gateway startup, customer machines with queued customer-service deliveries can
spend tens of seconds in recovery and time out normal gateway RPC calls. This
patch adds env-gated switches so RivonClaw Desktop can opt out while upstream
default behavior stays unchanged.

**Change:** Add `OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY` and
`OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY` checks around outbound delivery
recovery, restart-continuation delivery recovery, and main-session restart
recovery.

**Removal:** Drop when upstream OpenClaw exposes first-class config for startup
recovery policies or makes startup recovery sufficiently budgeted for RivonClaw
customer-service workloads.

### 0014 — Route remote media through RivonClaw cache

**File:** `0014-vendor-openclaw-route-remote-media-through-rivonclaw-cache.patch`

**Why:** RivonClaw Desktop users on the CN relay route cannot reliably fetch
GFW-blocked third-party media URLs such as TikTok Shop image/video assets from
agent media tools. Desktop owns the authenticated media-cache endpoint and the
first-party route decision, so OpenClaw should resolve remote media through
that local bridge before its normal guarded fetch.

**Change:** `fetchRemoteMedia()` asks `http://127.0.0.1:$RIVONCLAW_PANEL_PORT`
for `/api/media-cache/resolve` when the Desktop bridge token is present. The
Desktop endpoint returns the original URL on the global route and a cached
proxy URL on the CN relay route. If the bridge is unavailable outside the CN
relay route, upstream fetch behavior is preserved; on the CN relay route,
resolver failures surface as explicit RivonClaw media-cache errors.

**Tests:**

- `vendor/openclaw/src/media/fetch.test.ts`
- `apps/desktop/src/gateway/vendor-media-cache-proxy.sentinel.test.ts`

**Removal:** Drop when upstream OpenClaw exposes a host-provided remote-media
URL resolver hook that RivonClaw can configure without patching source.

### 0016 — Allow session context token patch

**File:** `0016-vendor-openclaw-allow-session-context-token-patch.patch`

**Why:** RivonClaw Customer Service sessions need a lower effective context cap
than coding/default agents to reduce per-dispatch prompt cost. OpenClaw already
stores and consumes per-session `contextTokens`, but `sessions.patch` does not
expose that field through the gateway protocol.

**Change:** Add `contextTokens` to the `sessions.patch` schema and persist or
clear it in the patch handler.

**Tests:**

- `vendor/openclaw/src/gateway/sessions-patch.test.ts`
- `apps/desktop/src/cs-bridge/customer-service-bridge.test.ts`
- `apps/desktop/src/cs-bridge/vendor-session-context-tokens.sentinel.test.ts`

**Removal:** Drop when upstream OpenClaw supports updating per-session
`contextTokens` through `sessions.patch` or another stable gateway session
settings API.

### 0019 — Run image tool prompts in a child process

**File:** `0019-vendor-openclaw-run-image-tool-prompts-in-child-process.patch`

**Why:** RivonClaw Customer Service can trigger OpenClaw's official `image`
tool on buyer-sent product images. Production logs showed the gateway event
loop and main-process CPU saturating while the tool was active. RivonClaw needs
to keep the official tool name and capability semantics while isolating the
heavy image-model prompt execution path from the gateway process.

**Change:** Keep `name: "image"` unchanged, but route `runImagePrompt()` through
a forked `image-tool-worker` child process by default. The main process still
does the existing argument normalization, media loading, sandbox checks, and
SSRF policy enforcement. If the worker cannot start or fails, OpenClaw falls
back to the original in-process prompt execution and logs the fallback. The
patch also prevents worker cold start and image model runtime resolution from
consuming the provider request timeout budget, so a cold worker does not reach
the image model with only a few seconds remaining.

**Tests:**

- `vendor/openclaw/src/media-understanding/image.test.ts`
- `vendor/openclaw/src/agents/tools/image-tool.test.ts`
- `apps/desktop/src/cs-bridge/vendor-image-tool-worker.sentinel.test.ts`

**Removal:** Drop when upstream OpenClaw runs image-tool media understanding
outside the gateway event-loop process or exposes an equivalent worker-backed
image tool execution option.

### 0020 — Stream Feishu card deltas

**File:** `0020-vendor-openclaw-stream-feishu-card-deltas.patch`

**Why:** RivonClaw defaults Feishu QR-created accounts to card streaming so
users see progress during long-running tasks. The pinned CardKit transport
pre-fills the streaming element with `Thinking...` and does not distinguish
successful updates from HTTP failures. Together with unstable partial snapshot
handling, this can leave a permanent Thinking card followed by the answer
content, suppress streaming progress, or repeat earlier text.

**Change:** Start with an empty CardKit streaming element, track text confirmed
as delivered, validate update responses, and replace the final element when it
diverges from the streamed preview. Keep OpenClaw's internal combined text for
final close while feeding stable answer/status deltas into the streaming
session. Agent content is preserved; the patch only corrects transport and
delivery state.

**Upstream status:** The CardKit transport lifecycle is fixed by OpenClaw
#82419 (`f436b4310a`) with the full-content preservation correction from
#90181 (`1f1ce8a1fe`). Remove this patch once the pinned vendor includes both
fixes and equivalent dispatcher delta handling.

**Tests:**

- `vendor/openclaw/extensions/feishu/src/reply-dispatcher.test.ts`
- `vendor/openclaw/extensions/feishu/src/streaming-card.test.ts`
- `apps/desktop/src/channels/vendor-feishu-card-streaming.sentinel.test.ts`

**Removal:** Drop when the pinned OpenClaw version contains the upstream
transport fixes above and its Feishu dispatcher preserves non-duplicated
streaming output in group and direct-message replies.

### 0021 — Request full Feishu card content

**File:** `0021-vendor-openclaw-request-full-Feishu-card-content.patch`

**Why:** Feishu's message APIs return only a CardKit reference unless callers
request `card_msg_content_type=user_card_content`. Without that parameter, an
agent sees `[Interactive Card]` when a user quotes one of its streamed card
replies instead of the quoted message body.

**Change:** Request full user-visible card JSON when reading a single quoted
message and when listing messages in a Feishu topic. Existing card parsing then
extracts the actual markdown without any local content cache or rewriting.

**Tests:**

- `vendor/openclaw/extensions/feishu/src/send.test.ts`
- `apps/desktop/src/channels/vendor-feishu-card-quote-content.sentinel.test.ts`

**Removal:** Drop when the pinned OpenClaw version includes upstream commit
`1db8ab3734221925ffe3af06a73d710fe8fdfdce` or an equivalent full-card message
read.

### 0022 — Handle asynchronous `taskkill` spawn errors

**File:** `0022-vendor-openclaw-handle-taskkill-spawn-errors.patch`

**Why:** On Windows, OpenClaw terminates `exec` and other managed child
processes with `taskkill`. Some packaged runtime environments do not expose
`taskkill.exe` through `PATH`; Node reports that failure asynchronously on the
spawned ChildProcess, so the existing synchronous `try/catch` cannot stop the
unhandled `ENOENT` event from crashing the gateway.

**Change:** Attach a one-shot `error` listener to the best-effort `taskkill`
child process. This is a minimal backport of upstream OpenClaw #101392 and does
not change process termination timing or fallback behavior.

**Upstream status:** Already fixed by OpenClaw #101392 in commit
`55fa22b482a7c6b8163f47590047c34b0dcd7382`. Deprecate this patch immediately
after the pinned vendor includes that commit.

**Tests:**

- `vendor/openclaw/src/process/kill-tree.test.ts`
- `apps/desktop/src/gateway/vendor-taskkill-spawn-error.sentinel.test.ts`

**Removal:** Drop when the pinned OpenClaw version includes upstream commit
`55fa22b482a7c6b8163f47590047c34b0dcd7382` or an equivalent asynchronous
`taskkill` error handler.

## Dropped Patches

### (Dropped in v2026.4.9 upgrade) Respect `ask=off` for obfuscation-triggered approvals

Previously patch 0003. Upstream commit `a74fb94fa3` ("fix(exec): remove host
obfuscation gating") removed the obfuscation detection from both
`bash-tools.exec-host-gateway.ts` and `bash-tools.exec-host-node.ts` entirely,
making this patch unnecessary. The `requiresExecApproval` function with
`ask=off` still returns `false` natively, satisfying the core EasyClaw
requirement.

### (Restored) Defer `prewarmConfiguredPrimaryModel`

Previously dropped in commit `e322752` based on warm-cache testing.
Restored as 0007 after production logs confirmed the ~9s event loop block
persists with multiple providers. See 0007 entry above for full context.
