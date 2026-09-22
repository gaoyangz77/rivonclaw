import { describe, expect, it } from "vitest";
import {
  AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH,
  isAffiliateCampaignNameValid,
} from "./affiliate-campaign-name.js";

describe("Affiliate Campaign display-name validation", () => {
  it("accepts multilingual names", () => {
    expect(isAffiliateCampaignNameValid("MX02-消化酶-智能-0921")).toBe(true);
  });

  it("rejects blank, overlong, and control-character names", () => {
    expect(isAffiliateCampaignNameValid("   ")).toBe(false);
    expect(isAffiliateCampaignNameValid("x".repeat(AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH + 1))).toBe(
      false,
    );
    expect(isAffiliateCampaignNameValid("line one\nline two")).toBe(false);
  });
});
