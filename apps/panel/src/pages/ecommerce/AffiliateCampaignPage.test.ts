import { describe, expect, it } from "vitest";
import {
  campaignErrorMessage,
  campaignShopDisplayName,
  DEFAULT_CAMPAIGN_STATUS_FILTERS,
  estimateCampaignCadence,
  isEnglishCampaignSearchPhrase,
  paginateCampaigns,
  renderAffiliateCampaignTemplatePreview,
} from "./AffiliateCampaignPage.js";

describe("Affiliate Campaign presentation contracts", () => {
  it("defaults the campaign directory to active, paused, and draft campaigns", () => {
    expect(DEFAULT_CAMPAIGN_STATUS_FILTERS).toEqual(["ACTIVE", "PAUSED", "DRAFT"]);
  });

  it("reports the average target rate over the twelve-hour paced window", () => {
    expect(estimateCampaignCadence(100, 0)).toBe("8.3");
    expect(estimateCampaignCadence(100, 50)).toBe("4.2");
    expect(estimateCampaignCadence(1, 0)).toBe("0.1");
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

  it("prefers the shop nickname and falls back to the provider shop name", () => {
    expect(
      campaignShopDisplayName(
        { alias: "  Five Shop  ", shopName: "Holylegend & DIYCOM" },
        "shop-id",
      ),
    ).toBe("Five Shop");
    expect(campaignShopDisplayName({ alias: " ", shopName: "Holylegend" }, "shop-id")).toBe(
      "Holylegend",
    );
    expect(campaignShopDisplayName(null, "shop-id")).toBe("shop-id");
  });

  it("requires a 2–8 word English Marketplace phrase", () => {
    expect(isEnglishCampaignSearchPhrase("necklace")).toBe(false);
    expect(isEnglishCampaignSearchPhrase("faith based fashion")).toBe(true);
    expect(isEnglishCampaignSearchPhrase("达人饰品")).toBe(false);
  });

  it("maps AI suggestion failures to specific localized messages", () => {
    const t = (key: string) => key;
    expect(campaignErrorMessage(new Error("CAMPAIGN_AI_SUGGESTION_TIMEOUT: timed out"), t)).toBe(
      "ecommerce.affiliateCampaign.errors.suggestionTimeout",
    );
    expect(campaignErrorMessage(new Error("CAMPAIGN_AI_SUGGESTION_INVALID: incomplete"), t)).toBe(
      "ecommerce.affiliateCampaign.errors.suggestionInvalid",
    );
  });
});
