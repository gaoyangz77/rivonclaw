import { describe, expect, it } from "vitest";
import {
  estimateCampaignCadence,
  paginateCampaigns,
  renderAffiliateCampaignTemplatePreview,
} from "./AffiliateCampaignPage.js";

describe("Affiliate Campaign presentation contracts", () => {
  it("reports the average target rate over the twelve-hour paced window", () => {
    expect(estimateCampaignCadence(100, 0)).toBe("≈ 8.3 / hr");
    expect(estimateCampaignCadence(100, 50)).toBe("≈ 4.2 / hr");
    expect(estimateCampaignCadence(1, 0)).toBe("≈ 0.1 / hr");
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

  it("paginates the campaign directory in stable twenty-row pages", () => {
    const campaigns = Array.from({ length: 45 }, (_, index) => `campaign-${index + 1}`);

    expect(paginateCampaigns(campaigns, 1)).toEqual(campaigns.slice(0, 20));
    expect(paginateCampaigns(campaigns, 2)).toEqual(campaigns.slice(20, 40));
    expect(paginateCampaigns(campaigns, 3)).toEqual(campaigns.slice(40, 45));
  });
});
