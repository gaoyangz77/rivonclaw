import { describe, expect, it } from "vitest";
import { AFFILIATE_CAMPAIGN_TRANSLATIONS } from
  "../../i18n/affiliate-campaign-translations.js";
import {
  campaignDecisionReasonLabel,
  campaignDeliveryFailureBreakdown,
  campaignErrorMessage,
  campaignCreatorStatesViewState,
  campaignFunnelCounterValue,
  campaignSearchGroupRuleSummary,
  campaignShopDisplayName,
  DEFAULT_CAMPAIGN_STATUS_FILTERS,
  estimateCampaignCadence,
  eligibilityReasonLabel,
  isEnglishCampaignSearchPhrase,
  normalizeSuggestedDiscoveryRules,
  normalizeCampaignExplanationLocale,
  paginateCampaigns,
  renderAffiliateCampaignTemplatePreview,
  unsupportedAffiliateCampaignTemplateVariables,
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

  it("does not render an unrecorded legacy funnel metric as zero", () => {
    expect(
      campaignFunnelCounterValue({
        counterSchemaVersion: 1,
        introducedInVersion: 2,
        value: 0,
      }),
    ).toBeNull();
    expect(
      campaignFunnelCounterValue({
        counterSchemaVersion: 2,
        introducedInVersion: 2,
        value: 0,
      }),
    ).toBe(0);
  });

  it("groups Provider delivery failures into stable product-facing reasons", () => {
    expect(
      campaignDeliveryFailureBreakdown([
        { code: "COLLABORATION_CREATOR_PRODUCT_CONFLICT", count: 5 },
        { code: "COLLABORATION_CREATOR_INVALID_OPEN_ID", count: 4 },
        { code: "COLLABORATION_CREATOR_NOT_ACCEPTED", count: 5 },
        { code: "UNCLASSIFIED_PROVIDER_ERROR", count: 6 },
      ], 20),
    ).toEqual([
      { category: "duplicateCollaboration", count: 5 },
      { category: "invalidCreator", count: 4 },
      { category: "providerNotAccepted", count: 5 },
      { category: "otherProviderRejection", count: 6 },
    ]);
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

  it("reports unsupported template variables before Campaign submission", () => {
    expect(
      unsupportedAffiliateCampaignTemplateVariables(
        "Hi {{ user_name }}, meet {{product_name}} from {{shop_name}} and {{user_name}}.",
      ),
    ).toEqual(["user_name"]);
    expect(
      unsupportedAffiliateCampaignTemplateVariables(
        "Hi {{creator_name}}, meet {{product_name}} from {{shop_name}}.",
      ),
    ).toEqual([]);
  });

  it("localizes unsupported template-variable guidance in every Campaign locale", () => {
    const messages = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
      (translations) =>
        translations.ecommerce.affiliateCampaign.templateUnsupportedVariables,
    );
    expect(messages.every(Boolean)).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("persists the supported UI language for Backend SearchPlan explanations", () => {
    expect(normalizeCampaignExplanationLocale("zh-CN")).toBe("ZH");
    expect(normalizeCampaignExplanationLocale("th_TH")).toBe("TH");
    expect(normalizeCampaignExplanationLocale("ja-JP")).toBe("EN");
  });

  it("localizes Cloud and Desktop SearchPlan provenance in all eight locales", () => {
    const sources = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
      ({ ecommerce }) => [
        ecommerce.affiliateCampaign.searchPlanGeneratedByCloud,
        ecommerce.affiliateCampaign.searchPlanGeneratedByDesktop,
      ],
    );
    expect(sources.flat().every(Boolean)).toBe(true);
    expect(new Set(sources.map((pair) => pair.join("|"))).size).toBe(8);
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
    expect(eligibilityReasonLabel("PROVIDER_PRODUCT_COLLABORATION_CONFLICT", t)).toBe(
      "translated:ecommerce.affiliateCampaign.eligibilityReason." +
        "provider_product_collaboration_conflict",
    );
  });

  it("has localized Provider product-conflict copy in every supported Campaign locale", () => {
    for (const translations of Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS)) {
      expect(
        translations.ecommerce.affiliateCampaign.eligibilityReason
          .provider_product_collaboration_conflict,
      ).toBeTruthy();
    }
  });

  it("localizes Target Collaboration quota waiting copy without exposing Provider codes", () => {
    const localized = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
      (translations) => translations.ecommerce.affiliateCampaign,
    );
    for (const campaign of localized) {
      expect(campaign.targetCollaborationQuotaTitle).toBeTruthy();
      expect(campaign.targetCollaborationQuotaDescription).toContain("{{count}}");
      expect(campaign.targetCollaborationQuotaScheduled).toBeTruthy();
      expect(campaign.targetCollaborationQuotaNextRetry).toBeTruthy();
      expect(JSON.stringify(campaign)).not.toContain("16024035");
    }
    expect(new Set(localized.map((campaign) => campaign.targetCollaborationQuotaTitle)).size)
      .toBe(localized.length);
  });

  it("maps selection decision codes through i18n instead of exposing English audit text", () => {
    const t = (key: string) => `translated:${key}`;
    expect(
      campaignDecisionReasonLabel(
        ["PROVIDER_FILTER_MATCH", "PROVIDER_ORDER"],
        "Qualified by TikTok Marketplace filters in provider order",
        t,
      ),
    ).toBe(
      "translated:ecommerce.affiliateCampaign.decisionReason.providerFilterMatch",
    );
    expect(campaignDecisionReasonLabel([], "UNMAPPED_BACKEND_TEXT", t)).toBe(
      "translated:ecommerce.affiliateCampaign.decisionReason.recorded",
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
