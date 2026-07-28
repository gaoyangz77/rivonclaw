import { describe, expect, it } from "vitest";
import {
  campaignErrorMessage,
  campaignCreatorStatesViewState,
  campaignSearchGroupRuleSummary,
  campaignShopDisplayName,
  DEFAULT_CAMPAIGN_STATUS_FILTERS,
  estimateCampaignCadence,
  eligibilityReasonLabel,
  isEnglishCampaignSearchPhrase,
  normalizeSuggestedDiscoveryRules,
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

  it("never presents a failed CreatorState query as an empty campaign", () => {
    expect(
      campaignCreatorStatesViewState({ loading: false, hasError: true, itemCount: 0 }),
    ).toBe("error");
    expect(
      campaignCreatorStatesViewState({ loading: false, hasError: false, itemCount: 0 }),
    ).toBe("empty");
    expect(
      campaignCreatorStatesViewState({ loading: false, hasError: false, itemCount: 3 }),
    ).toBe("ready");
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

  it("maps typed eligibility reasons through i18n instead of exposing backend codes", () => {
    const t = (key: string) => `translated:${key}`;
    expect(eligibilityReasonLabel("SHOP_CREATOR_7D_LIMIT", t)).toBe(
      "translated:ecommerce.affiliateCampaign.eligibilityReason.shop_creator_7d_limit",
    );
    expect(eligibilityReasonLabel("PROTECTION_LIST", t)).toBe(
      "translated:ecommerce.affiliateCampaign.eligibilityReason.protection_list",
    );
  });

  it("keeps TikTok's cross-product 90-day invitation filter off in AI suggestions", () => {
    expect(
      normalizeSuggestedDiscoveryRules({
        affiliatePerformance30d: {
          fastGrowingOnly: true,
          notInvitedLast90Days: true,
        },
      }).affiliatePerformance30d,
    ).toMatchObject({
      fastGrowingOnly: true,
      notInvitedLast90Days: false,
    });
  });

  it("summarizes every supported search-group filter instead of hiding AI rules", () => {
    const labels: Record<string, string> = {
      "ecommerce.affiliateCampaign.audienceGender": "受众性别",
      "ecommerce.affiliateCampaign.categoryPros": "擅长类目",
      "ecommerce.affiliateCampaign.gmv30d": "30 天 GMV 区间",
      "ecommerce.affiliateCampaign.minimumFollowersCompact": "粉丝下限",
    };
    const t = (key: string) => labels[key] ?? key;
    const summary = campaignSearchGroupRuleSummary(
      {
        followerCount: { minimum: 1_000, maximum: null },
        audience: {
          ageRanges: [],
          genderDistribution: { gender: "MALE", minimumPercentage: 60 },
        },
        salesPerformance30d: {
          gmvRanges: ["GMV_RANGE_1000_10000"],
          unitsSoldRanges: [],
        },
        categories: [{ parentCategoryId: "fashion", childCategoryIds: [] }],
        contentPerformance30d: { averageVideoViews: "10000" },
        affiliatePerformance30d: { fastGrowingOnly: true, notInvitedLast90Days: false },
        marketSpecific: {
          languages: [],
          creatorLevels: [],
          categoryPros: ["FASHION_AND_STYLE"],
        },
      },
      t,
    );

    expect(summary).toEqual(
      expect.arrayContaining([
        "粉丝下限",
        "受众性别: Male ≥ 60%",
        "30 天 GMV 区间: 1000 10000",
        "擅长类目: Fashion And Style",
        "ecommerce.affiliateCampaign.categoryConditionCount",
        "ecommerce.affiliateCampaign.contentConditionCount",
        "ecommerce.affiliateCampaign.affiliateConditionCount",
      ]),
    );
  });
});
