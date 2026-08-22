import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0036-vendor-openclaw-backport-Feishu-visible-delivery-cus.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");
const VENDOR_LIFECYCLE = resolve(VENDOR_ROOT, "src/channels/turn/lifecycle.ts");
const VENDOR_FEISHU_DISPATCHER = resolve(VENDOR_ROOT, "extensions/feishu/src/reply-dispatcher.ts");
const VENDOR_PENDING_DELIVERY_NOTICE = resolve(
  VENDOR_ROOT,
  "src/channels/turn/pending-delivery-notice.ts",
);

describe("vendor patch 0036: Feishu visible delivery custody", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("documents the exact upstream removal condition", () => {
    expect(patch).toContain("1096ca2a708f600386b6efd349823c759e041fcc");
    expect(patch).toContain("retain partial custody on preview cleanup");
  });

  it("settles already-visible partial delivery as delivered", () => {
    const lifecycle = readFileSync(VENDOR_LIFECYCLE, "utf8");
    expect(lifecycle).toContain("resolvePartialChannelDeliveryResult(error) !== undefined");
    expect(lifecycle).toContain(
      'settlePendingFinalDelivery(completion, "delivered", ["queued", "unknown"])',
    );
  });

  it("preserves visible custody when preview cleanup fails", () => {
    const dispatcher = readFileSync(VENDOR_FEISHU_DISPATCHER, "utf8");
    expect(dispatcher).toContain("normalizeStreamingFinalizationFailure");
    expect(dispatcher).toContain("failure?.result.visibleReplySent ? failure.error : error");
  });

  it("silently clears stale Feishu recovery debt", () => {
    const pendingNotice = readFileSync(VENDOR_PENDING_DELIVERY_NOTICE, "utf8");
    expect(pendingNotice).toContain('if (context.channel === "feishu")');
    expect(pendingNotice).toContain("await clearPendingDeliveryNotice({");
  });
});
