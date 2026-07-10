import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0021-vendor-openclaw-request-full-Feishu-card-content.patch",
);

describe("vendor patch 0021: preserve quoted Feishu card content", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");

  it("requests full user-visible card JSON for direct message and thread reads", () => {
    expect(patch).toContain('params: { card_msg_content_type: "user_card_content" }');
    expect(patch).toContain('card_msg_content_type: "user_card_content"');
    expect(patch).toContain("getMessageFeishu");
    expect(patch).toContain("listFeishuThreadMessages");
  });

  it("carries vendor assertions for both Feishu message APIs", () => {
    expect(patch).toContain("expect(mockClientGet).toHaveBeenCalledWith");
    expect(patch).toContain("expect(mockClientList).toHaveBeenCalledWith");
  });
});
