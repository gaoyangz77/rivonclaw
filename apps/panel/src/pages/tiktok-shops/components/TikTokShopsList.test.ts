// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./TikTokShopsList.tsx", import.meta.url), "utf8");

describe("TikTokShopsList table contract", () => {
  it("opens shop details from the shared interactive row without a redundant view button", () => {
    expect(source).toContain("<TkInteractiveTableRow");
    expect(source).toContain("onActivate={() => onView(shop.id)}");
    expect(source).not.toContain("onClick={() => onView(shop.id)}");
  });
});
