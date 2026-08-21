import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0036-vendor-openclaw-backport-Feishu-visible-delivery-cus.patch",
);
const VENDOR_LIFECYCLE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/channels/turn/lifecycle.ts",
);
const VENDOR_FEISHU_DISPATCHER = resolve(
  __dirname,
  "../../../../vendor/openclaw/extensions/feishu/src/reply-dispatcher.ts",
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
});
