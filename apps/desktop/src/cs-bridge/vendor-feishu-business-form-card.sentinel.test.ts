import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0028-vendor-openclaw-bridge-Feishu-business-form-cards.patch",
);

describe("vendor patch 0028: trusted Feishu raw card sends", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("allows only trusted Gateway clients to send raw Schema 2.0 cards", () => {
    expect(patch).toContain("readTrustedFeishuRawCard");
    expect(patch).toContain("operator.admin");
    expect(patch).toContain('raw.schema !== "2.0"');
    expect(patch).toContain("sendCardFeishu");
  });

  it("does not carry the retired Gateway callback bridge", () => {
    expect(patch).not.toContain("dispatchPluginInteractiveHandler");
    expect(patch).not.toContain("readBusinessAction");
    expect(patch).not.toContain("readBusinessChatTypeHint");
    expect(patch).not.toContain("form_value");
    expect(patch).not.toContain("rivonclaw.cs");
    expect(patch).not.toContain("monitor.account.ts");
    expect(patch).not.toContain("card-action.ts");
  });
});
