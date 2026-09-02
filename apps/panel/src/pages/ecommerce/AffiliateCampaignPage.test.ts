import { GQL } from "@rivonclaw/core";
import { describe, expect, it } from "vitest";
import { AFFILIATE_CAMPAIGN_TRANSLATIONS } from "../../i18n/affiliate-campaign-translations.js";
import {
  applySentCreatorStatePreset,
  campaignCreatorResponseSummary,
  campaignDecisionReasonLabel,
  campaignOutreachReasonLabel,
  campaignRuleMatchLabel,
  campaignMessageStepValid,
  campaignSkipsDirectMessage,
  affiliateCampaignCommissionRange,
  campaignDeliveryFailureBreakdown,
  campaignErrorMessage,
  campaignCreatorStatesViewState,
  campaignFunnelCounterValue,
  campaignSearchGroupRuleSummary,
  campaignShopDisplayName,
  countDistinctActiveCampaignShops,
  DEFAULT_CAMPAIGN_STATUS_FILTERS,
  estimateCampaignCadence,
  eligibilityReasonLabel,
  isEnglishCampaignSearchPhrase,
  isAffiliateCampaignCommissionRateValid,
  isSentCreatorStatePreset,
  normalizeSuggestedDiscoveryRules,
  normalizeCampaignExplanationLocale,
  paginateCampaigns,
  renderAffiliateCampaignTemplatePreview,
  SENT_CREATOR_STATE_STATUSES,
  toggleSentCreatorStatePreset,
  unsupportedAffiliateCampaignTemplateVariables,
} from "./AffiliateCampaignPage.js";

describe("Affiliate Campaign presentation contracts", () => {
  it("summarizes commissions without leaking product ids into customer-facing labels", () => {
    expect(affiliateCampaignCommissionRange([14])).toBe("14%");
    expect(affiliateCampaignCommissionRange([14, 8, 14])).toBe("8%–14%");
    expect(affiliateCampaignCommissionRange(["8.5", ""])).toBe("8.5%");
    expect(affiliateCampaignCommissionRange([])).toBe("—");
  });

  it("defaults the campaign directory to active, paused, and draft campaigns", () => {
    expect(DEFAULT_CAMPAIGN_STATUS_FILTERS).toEqual(["ACTIVE", "PAUSED", "DRAFT"]);
  });

  it("counts distinct shops only across active campaigns", () => {
    expect(
      countDistinctActiveCampaignShops([
        { shopId: "shop-a", status: GQL.AffiliateCampaignStatus.Active },
        { shopId: "shop-a", status: GQL.AffiliateCampaignStatus.Active },
        { shopId: "shop-b", status: GQL.AffiliateCampaignStatus.Active },
        { shopId: "shop-c", status: GQL.AffiliateCampaignStatus.Paused },
      ]),
    ).toBe(2);
  });

  it("reports the average target rate over the twelve-hour paced window", () => {
    expect(estimateCampaignCadence(100, 0)).toBe("8.3");
    expect(estimateCampaignCadence(100, 50)).toBe("4.2");
    expect(estimateCampaignCadence(1, 0)).toBe("0.1");
  });

  it("validates standard and Shop Ads rates against TikTok's 1–80% range", () => {
    expect(isAffiliateCampaignCommissionRateValid("1")).toBe(true);
    expect(isAffiliateCampaignCommissionRateValid("80")).toBe(true);
    expect(isAffiliateCampaignCommissionRateValid("0.5")).toBe(false);
    expect(isAffiliateCampaignCommissionRateValid("80.1")).toBe(false);
    expect(isAffiliateCampaignCommissionRateValid("")).toBe(false);
  });

  it("ships both commission labels and attribution guidance in all eight locales", () => {
    for (const { ecommerce } of Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS)) {
      expect(ecommerce.affiliateCampaign.ordinaryCommissionRate).toBeTruthy();
      expect(ecommerce.affiliateCampaign.shopAdsCommissionRate).toBeTruthy();
      expect(ecommerce.affiliateCampaign.offerHint).toBeTruthy();
    }
  });

  it("never presents a failed CreatorState query as an empty campaign", () => {
    expect(campaignCreatorStatesViewState({ loading: false, hasError: true, itemCount: 0 })).toBe(
      "error",
    );
    expect(campaignCreatorStatesViewState({ loading: false, hasError: false, itemCount: 0 })).toBe(
      "empty",
    );
    expect(campaignCreatorStatesViewState({ loading: false, hasError: false, itemCount: 3 })).toBe(
      "ready",
    );
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
      campaignDeliveryFailureBreakdown(
        [
          { code: "COLLABORATION_CREATOR_PRODUCT_CONFLICT", count: 5 },
          { code: "COLLABORATION_CREATOR_INVALID_OPEN_ID", count: 4 },
          { code: "COLLABORATION_CREATOR_NOT_ACCEPTED", count: 5 },
          { code: "UNCLASSIFIED_PROVIDER_ERROR", count: 6 },
        ],
        20,
      ),
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

  it("requires a template only when the Campaign sends a direct message", () => {
    const directMessage = GQL.AffiliateCampaignFirstTouchMode.DirectMessage;
    const collaborationOnly = GQL.AffiliateCampaignFirstTouchMode.CollaborationOnly;
    expect(campaignSkipsDirectMessage(directMessage)).toBe(false);
    expect(campaignSkipsDirectMessage(collaborationOnly)).toBe(true);

    expect(campaignMessageStepValid({ templateText: "", firstTouchMode: directMessage })).toBe(
      false,
    );
    expect(campaignMessageStepValid({ templateText: "   ", firstTouchMode: directMessage })).toBe(
      false,
    );
    expect(
      campaignMessageStepValid({ templateText: "Hi {{creator_name}}", firstTouchMode: directMessage }),
    ).toBe(true);
    // A collaboration-only Campaign keeps whatever template text the seller
    // drafted, but never needs one to advance.
    expect(
      campaignMessageStepValid({ templateText: "", firstTouchMode: collaborationOnly }),
    ).toBe(true);
    expect(
      campaignMessageStepValid({ templateText: "Hi {{creator_name}}", firstTouchMode: collaborationOnly }),
    ).toBe(true);
  });

  it("localizes the no-direct-message option in every Campaign locale", () => {
    for (const key of ["noDirectMessage", "noDirectMessageHint", "firstTouchCollaborationOnly"] as const) {
      const messages = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
        (translations) => translations.ecommerce.affiliateCampaign[key],
      );
      expect(messages.every(Boolean)).toBe(true);
      expect(new Set(messages).size).toBe(messages.length);
    }
  });

  it("localizes unsupported template-variable guidance in every Campaign locale", () => {
    const messages = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
      (translations) => translations.ecommerce.affiliateCampaign.templateUnsupportedVariables,
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
    const sources = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(({ ecommerce }) => [
      ecommerce.affiliateCampaign.searchPlanGeneratedByCloud,
      ecommerce.affiliateCampaign.searchPlanGeneratedByDesktop,
    ]);
    expect(sources.flat().every(Boolean)).toBe(true);
    expect(new Set(sources.map((pair) => pair.join("|"))).size).toBe(8);
  });

  it("presents SearchPlan internals as localized search conditions", () => {
    const campaigns = Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS).map(
      ({ ecommerce }) => ecommerce.affiliateCampaign,
    );
    for (const campaign of campaigns) {
      expect(campaign.searchPlan).toBeTruthy();
      expect(campaign.searchPlan).not.toMatch(/search\s*plan/i);
      expect(campaign.searchPlanPerformance).not.toMatch(/search\s*plan/i);
      expect(campaign.backToSearchConditions).toBeTruthy();
      expect(campaign.browseSearchConditions).toBeTruthy();
      expect(campaign.viewCampaignCreators).toBeTruthy();
      expect(campaign.creatorStatesForAllSearchPlans).toBeTruthy();
      expect(campaign.sentCreatorsPreset).toBeTruthy();
      expect(campaign.sentAt).toBeTruthy();
      expect(campaign.openSentCreators).toBeTruthy();
      expect(campaign.loadingCreatorStates).toBeTruthy();
      expect(campaign.viewFirstMessage).toBeTruthy();
      expect(campaign.hideFirstMessage).toBeTruthy();
      expect(campaign.copyFirstMessage).toBeTruthy();
      expect(campaign.firstMessageCopied).toBeTruthy();
      expect(campaign.firstMessageCopyFailed).toBeTruthy();
      expect(campaign.searchConditionsUsedToday).toContain("{{count}}");
      expect(campaign.viewBreakdown).toBeTruthy();
      expect(campaign.activeShops).toBeTruthy();
      expect(campaign.activeShopsDescription).toBeTruthy();
    }
    expect(new Set(campaigns.map((campaign) => campaign.searchPlan)).size).toBe(8);
    expect(new Set(campaigns.map((campaign) => campaign.viewFirstMessage)).size).toBe(8);
    expect(new Set(campaigns.map((campaign) => campaign.openSentCreators)).size).toBe(8);
    expect(new Set(campaigns.map((campaign) => campaign.sentAt)).size).toBe(8);
  });

  it("treats reached-out and replied creators as the sent-creator preset", () => {
    const { ReachedOut, Replied, Scheduled } = GQL.AffiliateCampaignCreatorStateStatus;

    expect(SENT_CREATOR_STATE_STATUSES).toEqual([ReachedOut, Replied]);
    expect(isSentCreatorStatePreset([ReachedOut, Replied])).toBe(true);
    expect(isSentCreatorStatePreset([Replied, ReachedOut])).toBe(true);
    expect(isSentCreatorStatePreset([ReachedOut])).toBe(false);
    expect(isSentCreatorStatePreset([ReachedOut, Replied, Scheduled])).toBe(false);
    expect(isSentCreatorStatePreset([])).toBe(false);
  });

  it("applies the sent-creator preset idempotently", () => {
    const { ReachedOut, Replied, Scheduled } = GQL.AffiliateCampaignCreatorStateStatus;

    expect(applySentCreatorStatePreset([])).toEqual([ReachedOut, Replied]);
    expect(applySentCreatorStatePreset([Scheduled])).toEqual([ReachedOut, Replied]);
    const alreadyPreset = [Replied, ReachedOut];
    expect(applySentCreatorStatePreset(alreadyPreset)).toBe(alreadyPreset);
    const fresh = applySentCreatorStatePreset([]);
    expect(fresh).not.toBe(SENT_CREATOR_STATE_STATUSES);
  });

  it("toggles the sent-creator preset off when it is already applied", () => {
    const { ReachedOut, Replied, Scheduled } = GQL.AffiliateCampaignCreatorStateStatus;

    expect(toggleSentCreatorStatePreset([])).toEqual([ReachedOut, Replied]);
    expect(toggleSentCreatorStatePreset([Scheduled])).toEqual([ReachedOut, Replied]);
    expect(toggleSentCreatorStatePreset([Replied, ReachedOut])).toEqual([]);
    expect(toggleSentCreatorStatePreset([ReachedOut, Replied, Scheduled])).toEqual([
      ReachedOut,
      Replied,
    ]);
  });

  it("summarizes the Creator response as reply, collaboration, or an open invitation", () => {
    const { ReachedOut, Replied, Scheduled, Discovered } =
      GQL.AffiliateCampaignCreatorStateStatus;
    const relationship = (collaborations: number, agent = 0, staff = 0) => ({
      activeAffiliateCollaborationIds: Array.from({ length: collaborations }, (_, i) => `c${i}`),
      workSummary: { agentRequiredCount: agent, staffRequiredCount: staff, externalWaitingCount: 9 },
    });

    expect(
      campaignCreatorResponseSummary({
        status: Replied,
        repliedAt: "2026-09-01T00:00:00.000Z",
        creatorRelationship: relationship(2, 1, 1),
      }),
    ).toEqual({
      kind: "replied",
      repliedAt: "2026-09-01T00:00:00.000Z",
      activeCollaborationCount: 2,
      pendingWorkCount: 2,
    });
    expect(
      campaignCreatorResponseSummary({
        status: ReachedOut,
        repliedAt: null,
        creatorRelationship: relationship(1),
      }),
    ).toMatchObject({ kind: "collaborating", activeCollaborationCount: 1, pendingWorkCount: 0 });
    expect(
      campaignCreatorResponseSummary({
        status: ReachedOut,
        repliedAt: null,
        creatorRelationship: relationship(0, 0, 3),
      }),
    ).toMatchObject({ kind: "awaiting", pendingWorkCount: 3 });
    expect(
      campaignCreatorResponseSummary({ status: Scheduled, repliedAt: null, creatorRelationship: null }),
    ).toMatchObject({ kind: "none", repliedAt: null, activeCollaborationCount: 0 });
    expect(campaignCreatorResponseSummary({ status: Discovered, repliedAt: null })).toMatchObject({
      kind: "none",
    });
  });

  it("explains an unreached Creator with one human reason and stays silent when qualified", () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key;
    const { Failed, Scheduled, ReachedOut, Disqualified, IneligibleProtected } =
      GQL.AffiliateCampaignCreatorStateStatus;
    const base = {
      outreachErrorCode: null,
      eligibilityReasonCode: null,
      decisionReason: null,
      decisionReasonCodes: [] as string[],
    };

    expect(
      campaignOutreachReasonLabel(
        { ...base, status: Failed, outreachErrorCode: "COLLABORATION_CREATOR_PRODUCT_CONFLICT" },
        false,
        t,
      ),
    ).toBe("ecommerce.affiliateCampaign.deliveryFailure.duplicateCollaboration");
    expect(campaignOutreachReasonLabel({ ...base, status: Failed }, false, t)).toBe(
      "ecommerce.affiliateCampaign.deliveryFailure.otherProviderRejection",
    );
    expect(
      campaignOutreachReasonLabel(
        { ...base, status: IneligibleProtected, eligibilityReasonCode: "PROTECTION_LIST" },
        false,
        t,
      ),
    ).toBe("ecommerce.affiliateCampaign.eligibilityReason.protection_list");
    expect(campaignOutreachReasonLabel({ ...base, status: Scheduled }, true, t)).toBe(
      "ecommerce.affiliateCampaign.targetCollaborationQuotaScheduled",
    );
    expect(
      campaignOutreachReasonLabel(
        { ...base, status: Disqualified, decisionReasonCodes: ["PRE_APPROVAL_REJECTED"] },
        false,
        t,
      ),
    ).toBe("ecommerce.affiliateCampaign.decisionReason.preApprovalRejected");
    expect(
      campaignOutreachReasonLabel(
        { ...base, status: ReachedOut, decisionReasonCodes: ["PROVIDER_FILTER_MATCH"] },
        false,
        t,
      ),
    ).toBeNull();
    expect(
      campaignOutreachReasonLabel(
        { ...base, status: Scheduled, decisionReasonCodes: ["PRE_APPROVAL_QUALIFIED"] },
        false,
        t,
      ),
    ).toBeNull();
    expect(campaignOutreachReasonLabel({ ...base, status: Scheduled }, false, t)).toBeNull();
  });

  it("labels rule matching without exposing provider enum names", () => {
    const t = (key: string) => key;
    expect(campaignRuleMatchLabel(GQL.AffiliateCampaignRuleFilterResult.Passed, t)).toBe(
      "ecommerce.affiliateCampaign.ruleMatched",
    );
    expect(campaignRuleMatchLabel(GQL.AffiliateCampaignRuleFilterResult.Failed, t)).toBe(
      "ecommerce.affiliateCampaign.ruleNotMatched",
    );
    expect(campaignRuleMatchLabel(null, t)).toBe("ecommerce.affiliateCampaign.ruleNotEvaluated");
  });

  it("ships the Creator-table column copy in every supported locale", () => {
    for (const locale of ["en", "zh", "de", "es", "fr", "id", "it", "th"] as const) {
      const copy = AFFILIATE_CAMPAIGN_TRANSLATIONS[locale].ecommerce.affiliateCampaign;
      for (const key of [
        "followers",
        "outreachStatus",
        "creatorResponse",
        "responseReplied",
        "responseCollaborating",
        "responseAwaiting",
        "responsePendingWork",
        "selectionBasis",
        "ruleMatched",
        "ruleNotMatched",
        "ruleNotEvaluated",
        "providerPagePosition",
        "preApprovalCutoffLine",
      ] as const) {
        expect(copy[key], `${locale}.${key}`).toBeTruthy();
        expect(copy[key], `${locale}.${key}`).not.toBe(
          locale === "en" ? "" : AFFILIATE_CAMPAIGN_TRANSLATIONS.en.ecommerce.affiliateCampaign[key],
        );
      }
    }
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
    expect(eligibilityReasonLabel("NO_CAMPAIGN_DISTURB", t)).toBe(
      "translated:ecommerce.affiliateCampaign.eligibilityReason.no_campaign_disturb",
    );
    expect(eligibilityReasonLabel("PROVIDER_PRODUCT_COLLABORATION_CONFLICT", t)).toBe(
      "translated:ecommerce.affiliateCampaign.eligibilityReason." +
        "provider_product_collaboration_conflict",
    );
  });

  it("has copy for every outreach-policy reason the Backend emits, in every locale", () => {
    const backendReasonCodes = [
      "PROTECTION_LIST",
      "NO_CAMPAIGN_DISTURB",
      "SAME_CAMPAIGN_ALREADY_CONTACTED",
      "SAME_CAMPAIGN_RESERVED_OR_SUBMITTED",
      "SHOP_CREATOR_7D_LIMIT",
      "CAMPAIGN_ALREADY_CONTACTED",
      "SHOP_CREATOR_PENDING_FIRST_TOUCH",
      "PROVIDER_PRODUCT_COLLABORATION_CONFLICT",
      "EXISTING_PRODUCT_COLLABORATION",
    ];
    for (const locale of ["en", "zh", "de", "es", "fr", "id", "it", "th"] as const) {
      const reasons = AFFILIATE_CAMPAIGN_TRANSLATIONS[locale].ecommerce.affiliateCampaign
        .eligibilityReason as Record<string, string>;
      for (const code of backendReasonCodes) {
        expect(reasons[code.toLowerCase()], `${locale} ${code}`).toBeTruthy();
      }
    }
  });

  it("has localized Provider product-conflict copy in every supported Campaign locale", () => {
    for (const translations of Object.values(AFFILIATE_CAMPAIGN_TRANSLATIONS)) {
      expect(
        translations.ecommerce.affiliateCampaign.eligibilityReason.no_campaign_disturb,
      ).toBeTruthy();
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
    expect(new Set(localized.map((campaign) => campaign.targetCollaborationQuotaTitle)).size).toBe(
      localized.length,
    );
  });

  it("maps selection decision codes through i18n instead of exposing English audit text", () => {
    const t = (key: string) => `translated:${key}`;
    expect(
      campaignDecisionReasonLabel(
        ["PROVIDER_FILTER_MATCH", "PROVIDER_ORDER"],
        "Qualified by TikTok Marketplace filters in provider order",
        t,
      ),
    ).toBe("translated:ecommerce.affiliateCampaign.decisionReason.providerFilterMatch");
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
