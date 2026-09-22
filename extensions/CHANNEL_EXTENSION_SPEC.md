# OpenClaw Channel Extension Specification

How to build a channel extension that integrates with OpenClaw's gateway, routing, and delivery systems.

Reference implementations:

- **Telegram** (full-featured, direct): `vendor/openclaw/extensions/telegram/`
- **Google Chat** (OAuth, direct): `vendor/openclaw/extensions/googlechat/`

---

## 1. Plugin Structure

A channel extension is an OpenClaw plugin that calls `api.registerChannel()` during `register()`.

### Minimum Viable Plugin

```js
// openclaw-plugin.mjs
const plugin = {
  id: "mychannel",
  name: "My Channel",
  description: "...",
  configSchema: {
    safeParse(value) {
      if (value === undefined) return { success: true, data: undefined };
      if (!value || typeof value !== "object" || Array.isArray(value))
        return { success: false, error: { issues: [{ path: [], message: "expected object" }] } };
      return { success: true, data: value };
    },
    jsonSchema: { type: "object", properties: {} },
  },
  register(api) {
    api.registerChannel({
      plugin: {
        id: "mychannel",
        meta: {
          /* ... */
        },
        capabilities: {
          /* ... */
        },
        config: {
          /* ... */
        },
        outbound: {
          /* ... */
        }, // needed for agent to know it can reply
      },
    });
  },
};
export default plugin;
```

### File Layout

```
extensions/mychannel/
  package.json              # "extensions": "./openclaw-plugin.mjs"
  openclaw-plugin.mjs       # Runtime plugin (plain JS, no TS transpile needed)
  openclaw-plugin.ts        # Source (optional, for dev)
  openclaw.plugin.json      # Declarative manifest (channels, configSchema)
  src/                      # Additional source if needed
```

**`package.json`** must declare:

```json
{
  "name": "@rivonclaw/mychannel",
  "extensions": "./openclaw-plugin.mjs"
}
```

**`openclaw.plugin.json`** (declarative fallback):

```json
{
  "id": "mychannel",
  "channels": ["mychannel"],
  "configSchema": { "type": "object", "properties": {} }
}
```

> **Important**: Use `.mjs` for the runtime plugin. In Electron's asar context, `jiti` cannot transpile `.ts` files (no esbuild binary). Plain JS avoids this.

---

## 2. Channel Meta

```ts
type ChannelMeta = {
  id: string; // Channel identifier (e.g. "telegram", "discord")
  label: string; // Display name (e.g. "Telegram")
  selectionLabel: string; // Shown in channel picker (e.g. "Telegram")
  docsPath: string; // Documentation URL path
  blurb: string; // Short description
  aliases?: string[]; // Alternative IDs for backward compatibility
  order?: number; // Sort order in UI lists
};
```

---

## 3. Capabilities

```ts
type ChannelCapabilities = {
  chatTypes: Array<"direct" | "group" | "channel" | "thread">;
  media?: boolean; // Supports image/file attachments
  reactions?: boolean; // Supports emoji reactions
  edit?: boolean; // Supports message editing
  unsend?: boolean; // Supports message deletion
  reply?: boolean; // Supports reply-to-message
  threads?: boolean; // Supports threaded conversations
  polls?: boolean; // Supports polls
  nativeCommands?: boolean; // Supports slash commands
  blockStreaming?: boolean; // Coalesce streaming chunks before delivery
};
```

### `blockStreaming`

When `true`, streaming text fragments are buffered and sent as larger blocks instead of individual chunks. This prevents message spam on channels with rate limits.

Configure coalescing defaults via the `streaming` adapter:

```ts
streaming: {
  blockStreamingCoalesceDefaults: {
    minChars: 1500,  // Buffer until this many chars accumulated
    idleMs: 1000,    // Or until this idle timeout elapsed
  },
},
```

### `media`

Set `media: true` if the channel can send/receive images. This affects:

- Whether the agent includes images in responses
- Whether the delivery pipeline calls `sendMedia()` instead of `sendText()`

---

## 4. Config Adapter

Manages account configuration for the channel.

```ts
type ChannelConfigAdapter<ResolvedAccount> = {
  listAccountIds: (cfg: OpenClawConfig) => string[];
  resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => ResolvedAccount;
  // Optional:
  isConfigured?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean;
  isEnabled?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean;
  resolveAllowFrom?: (params) => string[] | undefined;
};
```

For channels with no account management (e.g. relay-based channels):

```ts
config: {
  listAccountIds: () => [],
  resolveAccount: () => null,
},
```

---

## 5. Outbound Adapter

**Required** for the agent to know it can send messages via this channel.

```ts
type ChannelOutboundAdapter = {
  deliveryMode: "direct" | "gateway" | "hybrid";

  // Text chunking
  chunker?: (text: string, limit: number) => string[];
  chunkerMode?: "text" | "markdown";
  textChunkLimit?: number;

  // Target resolution
  resolveTarget?: (params: {
    cfg?: OpenClawConfig;
    to?: string;
    allowFrom?: string[];
    accountId?: string | null;
    mode?: "explicit" | "implicit" | "heartbeat";
  }) => { ok: true; to: string } | { ok: false; error: Error };

  // Message sending (both required for channel to be "deliverable")
  sendText?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
  sendMedia?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;

  // Optional: custom payload handler, polls
  sendPayload?: (ctx) => Promise<OutboundDeliveryResult>;
  sendPoll?: (ctx) => Promise<ChannelPollResult>;
};
```

### ChannelOutboundContext

Parameters passed to `sendText()` and `sendMedia()`:

```ts
type ChannelOutboundContext = {
  cfg: OpenClawConfig;
  to: string; // Recipient identifier
  text: string; // Message text (may be chunked)
  mediaUrl?: string; // URL of media to send (for sendMedia)
  gifPlayback?: boolean; // Hint to play as GIF
  replyToId?: string; // Message ID to reply to
  threadId?: string; // Thread identifier
  accountId?: string; // Account sending from
  deps?: OutboundSendDeps; // Injected dependencies
};
```

### OutboundDeliveryResult

What `sendText()` / `sendMedia()` must return:

```ts
type OutboundDeliveryResult = {
  channel: string; // Channel ID (e.g. "telegram")
  messageId: string; // Sent message ID
  chatId?: string; // Chat/conversation ID
};
```

### Delivery Modes

| Mode        | Description                                        | Use When                                  |
| ----------- | -------------------------------------------------- | ----------------------------------------- |
| `"direct"`  | Plugin sends messages directly to the platform API | Standard channels (Telegram, Discord)     |
| `"gateway"` | Delivery handled by the gateway/desktop app        | Relay-based channels                      |
| `"hybrid"`  | Can use either path                                | Channels with both local and remote modes |

### Gateway-Mode Outbound (Relay Pattern)

For relay-based channels where delivery is handled outside the plugin:

```js
outbound: {
  deliveryMode: "gateway",
  textChunkLimit: 2048,
  async sendText({ to, text }) {
    // Stub — text delivery handled via chat events → panel-server → relay.
    return { channel: "mychannel", messageId: "", chatId: to ?? "" };
  },
  async sendMedia({ to, text, mediaUrl }) {
    // Queue for panel-server (see "Image Outbound for Relay Channels" below).
    pendingImages.push({ to: to ?? "", mediaUrl: mediaUrl ?? "", text: text ?? "" });
    return { channel: "mychannel", messageId: "", chatId: to ?? "" };
  },
},
```

Both `sendText` and `sendMedia` are required for `isDeliverableMessageChannel()` to return `true`.

> **Critical**: A no-op `sendMedia` stub will **silently lose images**. The outbound system calls `sendMedia()` with the local file path (`mediaUrl`), receives success, and considers the image delivered. But nothing was actually sent. See [§9 Image Support → Outbound for Relay Channels](#outbound-agent--user-for-relay-channels) for the correct pattern.

### How `deliveryMode: "gateway"` Affects the Pipeline

When `deliveryMode` is `"gateway"`, the outbound system calls `callGateway()` which sends an HTTP request to the gateway's `send` endpoint. The gateway's send handler then calls `deliverOutboundPayloads()` which invokes the plugin's `sendText()`/`sendMedia()` directly. This means:

1. **Text delivery**: The plugin's `sendText()` is called, but actual text delivery for relay channels is handled separately via chat events → panel-server → relay WS. The stub return is fine.
2. **Image delivery**: The plugin's `sendMedia()` is called with `{ to, mediaUrl }` where `mediaUrl` is a local file path. A no-op stub loses the image. You must queue it for the panel-server to pick up via `registerGatewayMethod()`.

### Agent Behavior with Outbound Adapters

The presence of an outbound adapter changes the agent's image-sending strategy:

| Outbound Adapter   | Agent Behavior                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not registered** | Agent outputs `MEDIA:/path/to/file.jpg` in text. The text appears in chat events.                                                                                      |
| **Registered**     | Agent uses the `message` tool → outbound system → `sendMedia()`. Text response is just a confirmation like "发了". MEDIA: directives do NOT appear in chat event text. |

This means you **cannot** rely on parsing `MEDIA:` directives from chat events when an outbound adapter is registered. You must handle image delivery in `sendMedia()` itself.

---

## 6. Delivery Pipeline

When `deliver: true` is set in an agent RPC call, the standard pipeline runs:

```
Agent Response → resolveAgentDeliveryPlan() → deliverOutboundPayloads()
  → loadChannelOutboundAdapter(channelId)
  → createChannelHandler()
    → outbound.sendText() / outbound.sendMedia()
```

### Message Content Blocks

The agent response `message.content` is an array of content blocks:

```ts
// Text block
{ type: "text", text: "Hello world" }

// Image block (Claude API format)
{
  type: "image",
  source: {
    type: "base64",
    data: "iVBORw0KGgo...",   // base64-encoded image
    media_type: "image/png"
  }
}
```

The delivery pipeline extracts `mediaUrl`s from the response and calls `sendMedia()` for each.

### For Gateway-Mode Channels

When delivery is NOT handled by the standard pipeline (relay pattern), you intercept the `chat` event from the gateway RPC client:

```ts
gatewayRpc.onEvent = (evt) => {
  if (evt.event === "chat") {
    handleChatEvent(evt.payload);
  }
};

function handleChatEvent(payload) {
  // Match by runId to identify which channel user to reply to
  const runId = payload.runId;
  const userId = runIdMap.get(runId);
  if (!userId) return; // Not our channel's message

  if (payload.state === "final") {
    const content = payload.message?.content; // Array of content blocks
    // Extract text blocks → send as text
    // Extract image blocks → send as images
  } else if (payload.state === "error") {
    // Forward error message to user
  }
}
```

---

## 7. Inbound Messages

### Standard Path (Direct Channels)

For channels with webhook/polling (Telegram, Discord):

```
Platform Webhook → Channel Plugin Gateway Adapter → OpenClaw Inbound Pipeline
  → Session Resolution → Agent Processing → Chat Event Broadcast
```

The gateway adapter (`gateway.startAccount()`) sets up listeners that feed messages into the OpenClaw pipeline.

### Relay Path

For channels that use an external relay server:

```
Platform API → Relay Server → WebSocket → Desktop App (panel-server)
  → Gateway RPC client.request("agent", { ... })
```

The desktop app acts as a bridge:

```ts
await gatewayRpc.request("agent", {
  sessionKey: "agent:main:main", // Use main session for ChatPage display
  channel: "wechat", // Channel identifier
  message: textContent,
  attachments, // Image attachments (see below)
  idempotencyKey: messageId,
});
```

### Routing Replies (RunId Map)

Since the main session key is shared, use a `runId → userId` map to route replies:

```ts
const runIdMap = new Map<string, string>();

// After sending to agent:
const result = await rpc.request("agent", { ... });
runIdMap.set(result.runId, externalUserId);

// In chat event handler:
function handleChatEvent(payload) {
  const userId = runIdMap.get(payload.runId);
  if (!userId) return;
  if (payload.state === "final" || payload.state === "error") {
    runIdMap.delete(payload.runId);
    // Forward reply/error to user
  }
}
```

---

## 8. Session Keys

Format: `agent:${agentId}:${scope}`

| Scope            | Key Pattern                              | When                                      |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| Main             | `agent:main:main`                        | Default for all DM channels (recommended) |
| Per-peer         | `agent:main:direct:${peerId}`            | `dmScope: "per-peer"`                     |
| Per-channel-peer | `agent:main:${channel}:direct:${peerId}` | `dmScope: "per-channel-peer"`             |
| Group            | `agent:main:${channel}:group:${groupId}` | Group chats                               |
| Thread           | `${baseKey}:thread:${threadId}`          | Forum threads                             |

**Key rule**: Only messages on the main session key (`agent:main:main`) appear in the ChatPage UI. If you want your channel's messages visible in the panel chat page, use `agent:main:main`.

The `addChatRun()` function (which registers the run for ChatPage display) only fires when `canonicalSessionKey === mainSessionKey`.

---

## 9. Image Support

### Inbound (User → Agent)

Pass images as `attachments` in the agent RPC call. **Also save to disk** so the agent can reference the file path later (e.g. to forward or resend the image):

```ts
// Save image to disk for agent file path reference
const mediaDir = join(homedir(), ".rivonclaw", "openclaw", "media", "inbound");
const fileName = `mychannel-${Date.now()}.jpg`;
const filePath = join(mediaDir, fileName);
await fs.mkdir(mediaDir, { recursive: true });
await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));

await gatewayRpc.request("agent", {
  sessionKey: "agent:main:main",
  channel: "mychannel",
  message: `[用户发来图片，已保存至 ${filePath}]`,
  attachments: [
    {
      type: "image",
      mimeType: "image/jpeg", // MIME type
      content: base64EncodedData, // Base64 string
    },
  ],
  idempotencyKey: msgId,
});
```

> **Why save to disk?** The agent sees the image content via the attachment, but when it needs to send the image (e.g. user says "send this back to me"), it calls `sendMedia({ mediaUrl })` which requires a local file path. Without a saved file, the agent has no path to reference and will search old files in the media directory.

The gateway processes attachments via `parseMessageWithAttachments()`:

- Validates base64 content
- Sniffs MIME type for safety
- Rejects non-image attachments
- Max size: 5MB per image
- Strips data URL prefixes if present

### Outbound (Agent → User) for Direct Channels

For direct channels, the delivery pipeline handles outbound automatically via `sendMedia()`. No special handling needed.

### Outbound (Agent → User) for Relay Channels

For relay channels, the plugin runs inside the gateway process but the relay WS connection lives in the panel-server (a separate process). You need a bridge using `registerGatewayMethod()`:

**Step 1: Plugin queues images and registers a retrieval method**

```js
const pendingImages = [];

register(api) {
  // Panel-server calls this to retrieve queued images
  api.registerGatewayMethod("mychannel_get_pending_images", ({ respond }) => {
    const images = pendingImages.splice(0, pendingImages.length);
    respond(true, { images });
  });

  api.registerChannel({
    plugin: {
      // ...
      outbound: {
        async sendMedia({ to, text, mediaUrl }) {
          // Queue — panel-server will pick up via RPC and forward to relay
          pendingImages.push({ to: to ?? "", mediaUrl: mediaUrl ?? "", text: text ?? "" });
          return { channel: "mychannel", messageId: "", chatId: to ?? "" };
        },
      },
    },
  });
}
```

**Step 2: Panel-server retrieves pending images after each chat event**

```ts
async function handleChatEvent(payload) {
  // ... existing runId matching, text extraction ...

  if (payload.state === "final") {
    // Fetch images queued by the plugin's sendMedia
    const result = await gatewayRpc.request("mychannel_get_pending_images");
    const mediaFiles = [];
    if (result?.images?.length) {
      for (const img of result.images) {
        if (img.mediaUrl) mediaFiles.push(img.mediaUrl);
      }
    }

    // Read files from disk, base64 encode, send to relay
    for (const filePath of mediaFiles) {
      const data = await fs.readFile(filePath);
      const mimeType = getMimeFromExt(filePath);
      relaySend({ type: "image_reply", image_data: data.toString("base64"), image_mime: mimeType, ... });
    }
  }
}
```

**Why this works**: `sendMedia()` is called DURING agent processing (before the "final" chat event). The pending images are always available when the chat event fires. The panel-server retrieves them atomically via the gateway RPC.

### Outbound Flow Summary

```
Agent wants to send image
  → message tool → outbound system → plugin.sendMedia({ to, mediaUrl })
  → plugin queues { to, mediaUrl } in memory
  → plugin returns success
  → agent continues, generates text response
  → chat event "final" fires
  → panel-server: handleChatEvent()
    → calls gatewayRpc.request("mychannel_get_pending_images")
    → reads image file from mediaUrl path
    → sends image_reply frame to relay
    → relay uploads to platform API and delivers to user
```

---

## 10. Voice / Audio Support

### Inbound Voice

1. **Download** the audio from the platform API
2. **Convert** if needed (e.g. AMR → MP3 via ffmpeg for formats not supported by STT)
3. **Transcribe** using the STT manager
4. **Send** the transcribed text as the message content

```ts
// Supported STT formats (Groq Whisper):
const STT_SUPPORTED_FORMATS = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

// Convert unsupported formats:
if (!STT_SUPPORTED_FORMATS.has(format)) {
  const converted = await convertAudioToMp3(audioBuffer, format);
  audioBuffer = converted.data;
  format = converted.format;
}

const transcribed = await sttManager.transcribe(audioBuffer, format);
message = transcribed ?? "[语音消息 - 转写失败]";
```

### Outbound Voice

For channels supporting voice messages (Telegram), set `audioAsVoice: true` in the reply payload:

```ts
type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  audioAsVoice?: boolean; // Send as voice bubble instead of audio file
};
```

---

## 11. Error Handling

Always forward agent errors to the channel user:

```ts
if (payload.state === "error") {
  const errorMsg = payload.errorMessage ?? "An error occurred";
  // Send error message to user via channel
  sendToUser(userId, `⚠ ${errorMsg}`);
}
```

Common errors:

- Token/quota exhaustion (`exhausted` in error message)
- Model unavailable
- Context length exceeded
- Rate limiting

---

## 12. Relay Server Pattern (Optional)

For platforms behind firewalls or requiring server-to-server webhooks.

### Architecture

```
Platform API  ←→  Relay Server (cloud)  ←→  WebSocket  ←→  Desktop App (local)
                     ↑                                         ↑
               Receives webhooks,                     Forwards to agent,
               forwards via WS                        sends replies back
```

### WebSocket Protocol

Define typed frames for the relay protocol:

```ts
// Gateway → Relay
interface HelloFrame {
  type: "hello";
  gateway_id: string;
  auth_token: string;
}
interface ReplyFrame {
  type: "reply";
  id: string;
  external_user_id: string;
  content: string;
}
interface ImageReplyFrame {
  type: "image_reply";
  id: string;
  external_user_id: string;
  image_data: string;
  image_mime: string;
}

// Relay → Gateway
interface AckFrame {
  type: "ack";
  id: string;
}
interface InboundFrame {
  type: "inbound";
  id: string;
  external_user_id: string;
  msg_type: string;
  content: string;
  timestamp: number;
  media_data?: string;
  media_mime?: string;
}
interface ErrorFrame {
  type: "error";
  message: string;
}
```

### Relay Responsibilities

1. **Webhook receiver** — Accept platform callbacks (HTTP)
2. **Message sync** — Poll or receive messages from platform API
3. **Media download** — Download images/voice from platform, encode as base64
4. **Gateway forwarding** — Send inbound frames to connected gateways via WS
5. **Outbound delivery** — Receive reply frames, call platform send API
6. **Media upload** — Upload images to platform API to get media IDs
7. **Binding store** — Map platform user IDs ↔ gateway IDs (SQLite)
8. **Authentication** — Verify gateway connections via shared secret

### Desktop App Responsibilities

1. **Persistent WS connection** to relay (with auto-reconnect)
2. **Dedicated gateway RPC client** for forwarding messages to OpenClaw agent
3. **Chat event handler** — Intercept agent responses, route via runId map
4. **STT integration** — Transcribe voice messages locally
5. **Image attachment** — Pass downloaded images as attachments to agent RPC

---

## 13. Plugin Config Schema

For plugins with no configuration:

```js
configSchema: {
  safeParse(value) {
    if (value === undefined) return { success: true, data: undefined };
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { success: false, error: { issues: [{ path: [], message: "expected object" }] } };
    if (Object.keys(value).length > 0)
      return { success: false, error: { issues: [{ path: [], message: "config must be empty" }] } };
    return { success: true, data: value };
  },
  jsonSchema: { type: "object", additionalProperties: false, properties: {} },
},
```

For plugins with configuration, use Zod or manual schema:

```ts
import { z } from "zod";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

const schema = z.object({
  apiKey: z.string(),
  webhookUrl: z.string().url().optional(),
});

configSchema: buildChannelConfigSchema(schema),
```

---

## 14. Checklist: New Channel Extension

### Required

- [ ] `openclaw-plugin.mjs` with `register()` calling `api.registerChannel()`
- [ ] `openclaw.plugin.json` manifest
- [ ] `package.json` with `"extensions"` field
- [ ] Channel `meta` (id, label, selectionLabel, blurb)
- [ ] Channel `capabilities` (chatTypes at minimum)
- [ ] Channel `config` adapter (listAccountIds, resolveAccount)

### For Outbound (Agent → User)

- [ ] `outbound` adapter with `sendText` + `sendMedia`
- [ ] `deliveryMode` set appropriately
- [ ] `textChunkLimit` matching platform's message size limit

### For Inbound (User → Agent)

- [ ] Mechanism to receive messages (webhook, polling, relay WS)
- [ ] Forward to agent via `gatewayRpc.request("agent", { ... })`
- [ ] Use `sessionKey: "agent:main:main"` for ChatPage visibility
- [ ] Set `channel: "mychannel"` so agent knows the source
- [ ] Track `runId → userId` for reply routing

### For Images

- [ ] Set `capabilities.media: true`
- [ ] Inbound: download image, base64 encode, pass as `attachments`
- [ ] Outbound: extract `type === "image"` blocks from agent response content
- [ ] Platform image upload API if needed

### For Voice

- [ ] Download audio from platform
- [ ] Convert to STT-supported format if needed (ffmpeg)
- [ ] Transcribe via STT manager
- [ ] Send transcribed text as message

### For Relay (if needed)

- [ ] Relay server with HTTP webhook + WebSocket server
- [ ] Typed WS protocol (frames for hello, inbound, reply, image_reply, etc.)
- [ ] Binding store (user ↔ gateway mapping)
- [ ] Auto-reconnect on the desktop side
- [ ] Deploy script / Docker / systemd
