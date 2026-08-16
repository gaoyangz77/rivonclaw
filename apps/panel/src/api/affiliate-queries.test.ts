import { print } from "graphql";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY,
  AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY,
  AFFILIATE_CREATOR_PROFILE_QUERY,
  AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY,
  AFFILIATE_COLLABORATIONS_QUERY,
  AFFILIATE_OPEN_COLLABORATION_SETTINGS_QUERY,
  AFFILIATE_CREATORS_QUERY,
  AFFILIATE_ML_INSIGHTS_QUERY,
  AFFILIATE_ML_INSIGHTS_BULK_QUERY,
  AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  CREATE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
  CREATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
  EDIT_AFFILIATE_OPEN_COLLABORATION_SAMPLE_RULE_MUTATION,
  EDIT_AFFILIATE_OPEN_COLLABORATION_SETTINGS_MUTATION,
  REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
  REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
  UPDATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION,
} from "./shops-queries.js";

function queryText(document: Parameters<typeof print>[0]): string {
  return print(document);
}

describe("affiliate workspace GraphQL contracts", () => {
  it("requests only seller-safe Expected Sales comparison fields", () => {
    const query = queryText(AFFILIATE_ML_INSIGHTS_QUERY);

    expect(query).toContain("comparisonAvailable");
    expect(query).toContain("historicalApplicationCount");
    expect(query).toContain("expectedSalesLiftRatio");
    expect(query).toContain("sameBudgetComparison");
    expect(query).toContain("sameThresholdComparison");
    expect(query).toContain("historicalActualUnitsHistogram");
    expect(query).toContain("modelExpectedUnitsHistogram");
    expect(query).toContain("belowThresholdModelExpectedUnitsHistogram");
    expect(query).toContain("modelQualifiedHistoricalRejectedCount");
    expect(query).not.toContain("payload");
    expect(query).not.toContain("teacherModelVersionKey");
    expect(query).not.toContain("artifactRole");
    expect(query).not.toContain("evaluationStatus");
    const evaluation = query.split("evaluationSummary")[1] || "";
    expect(evaluation).not.toContain("modelVersionKey");
    expect(evaluation).not.toContain("bentomlTag");
    expect(evaluation).not.toContain("contractHash");
  });

  it("loads all shop and scope ML insights through one bulk query", () => {
    const query = queryText(AFFILIATE_ML_INSIGHTS_BULK_QUERY);

    expect(query).toContain("affiliateMlInsightsBulk(input: $input)");
    expect(query).toContain("shopId");
    expect(query).toContain("modelScope");
    expect(query).toContain("automaticExpectedSalesSelection");
    expect(query).toContain("outperformanceProbability");
    expect(query).not.toContain("confidenceLevel");
  });

  it("loads creator relationship roster from the creator relationship API", () => {
    const query = queryText(AFFILIATE_CREATORS_QUERY);

    expect(query).toContain("affiliateCreators(input: $input)");
    expect(query).toContain("creatorRelation");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("latestAffiliateCollaboration");
    expect(query).toContain("latestPendingProposal");
    expect(query).toContain("totalCount");
    expect(query).toContain("creatorPerformance");
  });

  it("loads the authoritative market-scoped Creator profile through one query", () => {
    const query = queryText(AFFILIATE_CREATOR_PROFILE_QUERY);

    expect(query).toContain("affiliateCreatorProfile(input: $input)");
    expect(query).toContain("freshnessStatus");
    expect(query).toContain("market");
    expect(query).toContain("performance");
    expect(query).toContain("refreshErrorCode");
  });

  it("loads campaign decisions with batched Creator profile, performance, and relationship context", () => {
    const query = queryText(AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY);

    expect(query).toContain("affiliateCampaignCreatorStates(input: $input)");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("creatorPerformance");
    expect(query).toContain("creatorRelationship");
    expect(query).toContain("activeAffiliateCollaborationIds");
    expect(query).toContain("productId");
    expect(query).toContain("eligibilityCategory");
    expect(query).toContain("eligibilityReasonCode");
    expect(query).toContain("sourceSearchPlanIds");
    expect(query).toContain("latestSearchPlanId");
    expect(query).toContain("latestSearchPlanGeneration");
  });

  it("loads approval proposals with relationship and collaboration focus context", () => {
    const query = queryText(AFFILIATE_ACTION_PROPOSALS_QUERY);

    expect(query).toContain("affiliateActionProposalPage(input: $input)");
    expect(query).toContain("nextCursor");
    expect(query).toContain("hasMore");
    expect(query).toContain("creatorRelationshipId");
    expect(query).toContain("creatorRelationship");
    expect(query).toContain("shopStates");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("sourceWorkBoundary");
    expect(query).toContain("affiliateCollaboration");
    expect(query).toContain("sampleApplicationRecord");
    expect(query).toContain("sampleReviewIntent");
    expect(query).toContain("predictionSnapshots");
    expect(query).toContain("sourceCacheId");
    expect(query).toContain("capturedAt");
    expect(query).toContain("steps");
  });

  it("loads canonical platform collaborations directly for the collaboration history page", () => {
    const query = queryText(AFFILIATE_COLLABORATIONS_QUERY);

    expect(query).toContain("affiliateCollaborations(input: $input)");
    expect(query).toContain("creatorIds");
    expect(query).toContain("creatorOpenIds");
    expect(query).toContain("productIds");
    expect(query).toContain("platformCollaborationId");
    expect(query).toContain("openSampleRule");
    expect(query).toContain("sellerContactInfo");
    expect(query).toContain("freeSampleRule");
    expect(query).toContain("targetCreators");
    expect(query).toContain("products");
    expect(query).not.toContain("collaborationRecords");
  });

  it("exposes the complete platform collaboration operation surface", () => {
    const operations = [
      AFFILIATE_OPEN_COLLABORATION_SETTINGS_QUERY,
      EDIT_AFFILIATE_OPEN_COLLABORATION_SETTINGS_MUTATION,
      CREATE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
      EDIT_AFFILIATE_OPEN_COLLABORATION_SAMPLE_RULE_MUTATION,
      REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
      CREATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
      UPDATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
      REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
    ].map(queryText).join("\n");

    expect(operations).toContain("affiliateOpenCollaborationSettings(shopId: $shopId)");
    expect(operations).toContain("editAffiliateOpenCollaborationSettings(input: $input)");
    expect(operations).toContain("createAffiliateOpenCollaboration(input: $input)");
    expect(operations).toContain("editAffiliateOpenCollaborationSampleRule(input: $input)");
    expect(operations).toContain("removeAffiliateOpenCollaboration(input: $input)");
    expect(operations).toContain("createAffiliateTargetCollaboration(input: $input)");
    expect(operations).toContain("updateAffiliateTargetCollaboration(input: $input)");
    expect(operations).toContain("removeAffiliateTargetCollaboration(input: $input)");
  });

  it("loads relationship detail from separate canonical entity pages", () => {
    const detail = queryText(AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY);
    const samples = queryText(AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY);
    const platform = queryText(AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY);
    const timeline = queryText(AFFILIATE_RELATIONSHIP_TIMELINE_QUERY);

    expect(detail).toContain("agendaItems");
    expect(detail).toContain("activeSampleApplicationCount");
    expect(detail).toContain("activePlatformCollaborationCount");
    expect(samples).toContain("affiliateRelationshipSampleApplications");
    expect(samples).toContain("platformApplicationId");
    expect(samples).toContain("productSummaries");
    expect(platform).toContain("affiliateRelationshipPlatformCollaborations");
    expect(platform).toContain("sources");
    expect(platform).toContain("productIds");
    expect(timeline).toContain("affiliateCollaborationId");
    expect([detail, samples, platform, timeline].join("\n")).not.toContain("collaborationRecord");
  });

  it("retains work items as an internal relationship dispatch contract", () => {
    const query = queryText(AFFILIATE_WORK_ITEMS_QUERY);

    expect(query).toContain("affiliateWorkItems(input: $input)");
    expect(query).toContain("creatorRelation");
    expect(query).toContain("focusCollaboration");
    expect(query).toContain("activeCollaborations");
    expect(query).not.toContain("latestPendingProposal");
  });

  it("decides proposals at creator relationship granularity", () => {
    const mutation = queryText(DECIDE_ACTION_PROPOSAL_MUTATION);

    expect(mutation).toContain("decideActionProposal(input: $input)");
    expect(mutation).toContain("creatorRelationshipId");
    expect(mutation).toContain("decision");
    expect(mutation).toContain("predictionSnapshots");
  });

  it("loads exact seller-account to Creator contact assets", () => {
    const query = queryText(AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY);

    expect(query).toContain("affiliateCreatorChannelContacts(input: $input)");
    expect(query).toContain("creatorRelationshipId");
    expect(query).toContain("accountBindingId");
    expect(query).toContain("businessDeveloperId");
    expect(query).toContain("effectiveAlias");
  });

  it("sets the preferred sender account through the BD-scoped mutation", () => {
    const mutation = queryText(SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION);

    expect(mutation).toContain("setAffiliateBusinessDeveloperPreferredAccount(input: $input)");
    expect(mutation).toContain("preferredWhatsAppAccountBindingId");
    expect(mutation).toContain("preferredEmailAccountBindingId");
  });
});
