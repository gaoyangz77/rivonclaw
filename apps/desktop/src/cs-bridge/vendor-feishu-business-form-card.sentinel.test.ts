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

describe("vendor patch 0028: Feishu business form cards", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("allows only trusted Gateway clients to send raw Schema 2.0 cards", () => {
    expect(patch).toContain("readTrustedFeishuRawCard");
    expect(patch).toContain("operator.admin");
    expect(patch).toContain('raw.schema !== "2.0"');
    expect(patch).toContain("sendCardFeishu");
  });

  it("preserves form fields and dispatches business actions through plugin handlers", () => {
    expect(patch).toContain("form_value");
    expect(patch).toContain("form_name");
    expect(patch).toContain("value.event_id");
    expect(patch).toContain("actionName?.includes");
    expect(patch).toContain("recovers a namespaced business action from form_submit name");
    expect(patch).toContain("dispatchPluginInteractiveHandler");
    expect(patch).toContain("readBusinessAction");
  });

  it("keeps business callbacks synchronous and out of synthetic agent dispatch", () => {
    expect(patch).toContain("return await handleFeishuCardAction");
    expect(patch).toContain("fails closed when a namespaced business handler is unavailable");
    expect(patch).toContain("never invokes the agent");
    expect(patch).not.toContain("cs_list_open_escalations");
  });
});
