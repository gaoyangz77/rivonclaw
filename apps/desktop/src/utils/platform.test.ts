import { describe, expect, it } from "vitest";
import { creatorFacingPlatformName, normalizePlatform } from "./platform";

describe("creatorFacingPlatformName", () => {
  it("names the platform the way a Creator would recognise it", () => {
    expect(creatorFacingPlatformName("TIKTOK_SHOP")).toBe("TikTok Shop");
    expect(creatorFacingPlatformName("tiktok")).toBe("TikTok Shop");
  });

  /**
   * The name is looked up by the normalized token, so a platform added to
   * `normalizePlatform` without a Creator-facing name here cannot silently
   * inherit TikTok Shop's.
   */
  it("returns null for a platform it has no name for", () => {
    expect(creatorFacingPlatformName("SHOPEE_SHOP")).toBeNull();
    expect(creatorFacingPlatformName("")).toBeNull();
  });

  it("keys off the same normalization the session key uses", () => {
    expect(creatorFacingPlatformName(normalizePlatform("TIKTOK_SHOP"))).toBe("TikTok Shop");
  });
});
