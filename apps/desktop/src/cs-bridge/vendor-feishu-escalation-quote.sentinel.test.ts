import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0027-vendor-openclaw-surface-failed-Feishu-quote-reads.patch",
);

describe("vendor patch 0027: explicit Feishu quote failures", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("carries diagnostic quoted-message fetch failures", () => {
    expect(patch).toContain("class FeishuMessageFetchError");
    expect(patch).toContain('reason: "api_response"');
    expect(patch).toContain('reason: "empty_response"');
    expect(patch).toContain('reason: "parse_error"');
    expect(patch).toContain('reason: "request_exception"');
    expect(patch).toContain("FEISHU_MESSAGE_GET_MAX_ATTEMPTS");
    expect(patch).toContain("requestFeishuApi");
  });

  it("makes missing quote content explicit to the agent", () => {
    expect(patch).toContain("QUOTED_MESSAGE_UNAVAILABLE_CONTEXT");
    expect(patch).toContain("The quoted content is missing from this turn");
    expect(patch).toContain("Do not infer or guess it");
    expect(patch).toContain(
      "tells the agent when quoted content remains unavailable after retries",
    );
    expect(patch).not.toContain("escalation-message-cache");
  });

  it("keeps successful non-CS quote handling covered", () => {
    expect(patch).toContain(
      'expect(context.SupplementalContext?.quote?.body).toBe("quoted content")',
    );
    expect(patch).toContain("keeps root_id-only P2P replies as quote replies outside thread mode");
    expect(patch).not.toContain("cs_list_open_escalations");
  });
});
