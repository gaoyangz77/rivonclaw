# TS-009: OpenClaw v2026.5.2 Windows Media fsync EPERM

Date: 2026-05-12

## Summary

OpenClaw v2026.5.2 has a Windows-specific media persistence regression. Inbound
images or attachments can be received by the channel layer, but fail before they
are persisted into `media/inbound`, so the agent starts with zero attachments.

This has been observed with Telegram and Weixin in EasyClaw customer logs, and
matches upstream OpenClaw reports for WebChat, Feishu picture receive, generated
images, and generic attachment offload.

## Symptoms

- Telegram replies to the sender with:

```text
Failed to download media. Please try again.
```

- Gateway logs show media persistence failing with Windows `EPERM`:

```text
chat.send: failed to persist inbound image (image/jpeg): Error: EPERM: operation not permitted, fsync: code=EPERM
```

- The downstream agent run starts without the image:

```text
Agent dispatch request starting ... attachments=0
```

- `media/inbound` may stay empty even though the channel received the image.

## Affected Versions

- Confirmed affected upstream version: OpenClaw v2026.5.2 on Windows.
- Fixed upstream release: OpenClaw v2026.5.4.

Customer log clue:

```text
compile-cache\openclaw\2026.5.2\...
```

## Root Cause

Upstream OpenClaw changed media writes to sync a staged temp file before
renaming it into place. The affected code opened the temp file read-only with
`fs.open(tempDest, "r")`, then called `handle.sync()`.

On Windows, `handle.sync()` maps to `FlushFileBuffers`, which requires write
access to the file handle. A read-only handle fails with:

```text
EPERM: operation not permitted, fsync
```

Linux and macOS permit this pattern, so the regression is Windows-specific.

## Impact

This is not limited to Telegram. Any feature that routes media through
OpenClaw's shared media store or attachment offload path can fail on Windows,
including:

- Telegram inbound images
- Weixin inbound images
- WebChat attachments
- Feishu picture receive
- `image_generate` output persistence

The channel-specific user-facing message may vary. Telegram reports the failure
as a media download error, even when the real failure is the local media-store
fsync step.

## Workaround / Fix

Preferred fix: upgrade the vendored OpenClaw runtime to v2026.5.4 or newer, or
backport the upstream one-line fix from PR #76593.

Upstream fix:

```ts
await fs.open(tempDest, "r+")
```

instead of:

```ts
await fs.open(tempDest, "r")
```

If the deployed build cannot be upgraded immediately, treat Windows reports of
`EPERM ... fsync` during media persistence as this known vendor issue rather
than antivirus, permission, or channel-specific breakage.

## References

- openclaw/openclaw#77016: `[Bug] EPERM fsync on Windows - image_generate + Feishu picture receive both broken in 2026.5.2`
  https://github.com/openclaw/openclaw/issues/77016
- openclaw/openclaw#76977: `[Bug]: MediaOffloadError: EPERM operation not permitted, fsync`
  https://github.com/openclaw/openclaw/issues/76977
- openclaw/openclaw#76593: `fix(media): use r+ instead of r for fs.open to fix EPERM on fsync on Windows`
  https://github.com/openclaw/openclaw/pull/76593
- OpenClaw v2026.5.4 release notes: `Media/Windows: open saved attachment temp files read/write before fsync...`
  https://newreleases.io/project/github/openclaw/openclaw/release/v2026.5.4

## Verification

After upgrading or backporting the fix, verify on Windows:

1. Send an image through Telegram.
2. Send an image through Weixin.
3. Confirm files appear under `media/inbound`.
4. Confirm the agent dispatch log includes non-zero attachments.
5. Confirm the log no longer contains `EPERM: operation not permitted, fsync`.
