# Known Limitations

## Web QR login provider metadata is missing upstream

**Status:** Wrapper workaround in `extensions/channel-weixin/src/index.ts`
**Upstream repo:** https://github.com/Tencent/openclaw-weixin
**Affected versions:** <= 2.1.7

RivonClaw starts WeChat QR login from the desktop UI through OpenClaw gateway
RPC methods `web.login.start` and `web.login.wait`. The upstream Weixin plugin
implements the QR login gateway handlers, but does not currently declare those
methods in `ChannelPlugin.gatewayMethods`, so OpenClaw can fail provider
discovery with `web login provider is not available`.

Our wrapper declares the missing methods before registering the upstream channel
plugin. Remove that wrapper patch after upstream ships the declaration and our
supported `@tencent-weixin/openclaw-weixin` version range requires that release.

**Upstream tracking:**
- Issue: https://github.com/openclaw/openclaw/issues/62120
- PR: https://github.com/Tencent/openclaw-weixin/pull/73
- Prior art: https://github.com/netease-youdao/LobsterAI/pull/1592

## Voice messages lose quote context

**Status:** Upstream bug in `@tencent-weixin/openclaw-weixin`
**Upstream repo:** https://github.com/Tencent/openclaw-weixin
**Affected versions:** <= 2.1.7

When a user sends a voice message that quotes/replies to a previous message,
the agent does not see the quoted content. Text messages with quotes work
correctly (prepended as `[引用: ...]`).

**Root cause:** In the upstream `inbound.ts`, the `bodyFromItemList` function
only checks `ref_msg` for `TEXT` items. For `VOICE` items it returns
`voice_item.text` (the STT transcription) directly, ignoring `ref_msg`.

**Scope:** This is purely an upstream issue. Our wrapper, OpenClaw's engine,
and our STT package (`packages/stt`) are not involved -- the quote context is
already dropped before it reaches any of our code.

**Upstream tracking:**
- Issue: https://github.com/Tencent/openclaw-weixin/issues/48
- PR: https://github.com/Tencent/openclaw-weixin/pull/49

**Workaround:** None available from the wrapper side. The fix needs to happen
in the upstream plugin's `bodyFromItemList` to apply the same `ref_msg` handling
for `VOICE` items as it does for `TEXT` items.
