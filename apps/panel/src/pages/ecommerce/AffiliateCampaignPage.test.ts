import { describe, expect, it } from "vitest";
import {
  estimateCampaignCadence,
  renderAffiliateCampaignTemplatePreview,
} from "./AffiliateCampaignPage.js";

describe("Affiliate Campaign presentation contracts", () => {
  it("derives the nominal cadence from the fixed fourteen-hour outreach window", () => {
    expect(estimateCampaignCadence(100, 0)).toBe("≈ 8 min");
    expect(estimateCampaignCadence(100, 50)).toBe("≈ 17 min");
    expect(estimateCampaignCadence(1, 0)).toBe("≈ 840 min");
  });

  it("renders only the supported first-touch template variables", () => {
    expect(
      renderAffiliateCampaignTemplatePreview(
        "Hi {{creator_name}}, feature {{product_name}} from {{shop_name}}.",
        "Summer Bag",
        "Rivon",
      ),
    ).toBe("Hi Alex, feature Summer Bag from Rivon.");
  });
});
