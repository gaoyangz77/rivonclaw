import { createServer } from "node:http";

const port = 3210;
const theme = process.env.WORKBENCH_REVIEW_THEME === "light" ? "light" : "dark";
const now = "2026-08-30T18:25:00.000Z";

const shop = {
  id: "shop-northstar",
  userId: "review-user",
  platform: "tiktok",
  platformAppId: "app-review",
  platformShopId: "US-NORTHSTAR-01",
  collectionKey: "review",
  shopName: "Northstar Beauty",
  alias: "Northstar US",
  authStatus: "AUTHORIZED",
  region: "US",
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  services: {
    customerService: null,
    wms: null,
    affiliateService: {
      enabled: true,
      deviceId: null,
      runProfileId: null,
      businessPrompt: null,
      campaignDailyCreatorOutreachLimit: 40,
      campaignDailyCreatorOutreachLimitRevision: 1,
      campaignDailyCreatorOutreachLimitUpdatedAt: null,
      decisionThresholds: null,
    },
  },
};

const campaigns = [
  {
    id: "campaign-active",
    userId: "review-user",
    shopId: shop.id,
    name: "Creator Growth · Fall Launch",
    status: "ACTIVE",
    productSnapshotId: "snapshot-serum",
    productSnapshotHash: "snapshot-serum-v1",
    productSnapshot: {
      id: "snapshot-serum",
      productId: "product-serum",
      title: "Barrier Reset Serum",
      sellerSkus: ["SERUM-30ML"],
      description: "Daily barrier support",
      status: "ACTIVE",
      coverImage: null,
      originalCurrency: "USD",
      minimumPriceUsdAmount: "32",
      maximumPriceUsdAmount: "32",
      categoryPathIds: [],
      categoryPathNames: ["Beauty", "Skin care"],
      brandId: null,
      brandName: "Northstar",
      observedAt: now,
      snapshotHash: "snapshot-serum-v1",
    },
    searchPlanGuidance: null,
    searchPlanExplanationLocale: null,
    searchPlanning: {
      state: "READY",
      generationSequence: 2,
      activePlanId: "plan-active",
      lastPlanCompletedAt: now,
      generationRequest: null,
    },
    market: "US",
    resolvedTimeZone: "America/Los_Angeles",
    dailyOutreachTarget: 40,
    products: [
      { productId: "product-serum", commissionRatePercent: "15", shopAdsCommissionRatePercent: "5" },
    ],
    endDays: 30,
    isSampleApprovalExempt: false,
    sellerContactEmail: null,
    selectionPolicy: { strategy: "EXPECTED_SALES" },
    messageTemplateText: "Hi {{creator_name}}, we would love to collaborate.",
    messageTemplateSource: "CUSTOM",
    messageProductName: "Barrier Reset Serum",
    templateVersion: 1,
    templateTextHash: "template-v1",
    configRevision: 3,
    needsReconfiguration: false,
    nextTickAt: "2026-08-30T20:00:00.000Z",
    activatedAt: "2026-08-21T16:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    createdAt: "2026-08-20T16:00:00.000Z",
    updatedAt: now,
  },
  {
    id: "campaign-paused",
    userId: "review-user",
    shopId: shop.id,
    name: "Always-on creator discovery",
    status: "PAUSED",
    productSnapshotId: "snapshot-cleanser",
    productSnapshotHash: "snapshot-cleanser-v1",
    productSnapshot: {
      id: "snapshot-cleanser",
      productId: "product-cleanser",
      title: "Cloud Wash Cleanser",
      sellerSkus: ["WASH-120ML"],
      description: "Gentle daily cleanser",
      status: "ACTIVE",
      coverImage: null,
      originalCurrency: "USD",
      minimumPriceUsdAmount: "24",
      maximumPriceUsdAmount: "24",
      categoryPathIds: [],
      categoryPathNames: ["Beauty", "Skin care"],
      brandId: null,
      brandName: "Northstar",
      observedAt: now,
      snapshotHash: "snapshot-cleanser-v1",
    },
    searchPlanGuidance: null,
    searchPlanExplanationLocale: null,
    searchPlanning: {
      state: "READY",
      generationSequence: 1,
      activePlanId: "plan-paused",
      lastPlanCompletedAt: "2026-08-29T18:00:00.000Z",
      generationRequest: null,
    },
    market: "US",
    resolvedTimeZone: "America/Los_Angeles",
    dailyOutreachTarget: 24,
    products: [
      { productId: "product-cleanser", commissionRatePercent: "12", shopAdsCommissionRatePercent: "0" },
    ],
    endDays: 45,
    isSampleApprovalExempt: false,
    sellerContactEmail: null,
    selectionPolicy: { strategy: "MERCHANT_APPROVAL_TENDENCY" },
    messageTemplateText: "A concise creator collaboration brief.",
    messageTemplateSource: "CUSTOM",
    messageProductName: "Cloud Wash Cleanser",
    templateVersion: 1,
    templateTextHash: "template-v2",
    configRevision: 2,
    needsReconfiguration: false,
    nextTickAt: null,
    activatedAt: "2026-08-12T16:00:00.000Z",
    pausedAt: "2026-08-29T18:00:00.000Z",
    completedAt: null,
    createdAt: "2026-08-10T16:00:00.000Z",
    updatedAt: "2026-08-29T18:00:00.000Z",
  },
];

const creators = [
  ["maya.builds", "Maya Chen", 248_000, 84_600, 0.074, 38],
  ["theglowedit", "Sofia Park", 91_200, 32_100, 0.061, 24],
  ["routine.lab", "Jordan Lee", 433_000, 127_000, 0.083, 61],
  ["skinnotes", "Avery Stone", 57_200, 18_400, 0.052, 17],
  ["dailyform", "Taylor Reed", 166_000, 49_600, 0.068, 29],
  ["softfocus.co", "Nina Ross", 305_000, 73_100, 0.071, 45],
];

const proposals = creators.map((creator, index) => {
  const type =
    index === 2 || index === 4
      ? "NO_ACTION_NEEDED"
      : index === 3 || index === 5
        ? "REVIEW_SAMPLE_APPLICATION"
        : "SEND_MESSAGE";
  const sampleDecision = index === 3 ? "APPROVE" : index === 5 ? "REJECT" : null;
  const proposalId = `proposal-${index + 1}`;
  const creatorId = `creator-${index + 1}`;
  const sampleApplicationRecordId = sampleDecision ? `sample-${index + 1}` : null;

  return {
    id: proposalId,
    userId: "review-user",
    focusShopId: shop.id,
    shopIds: [shop.id],
    campaignId: null,
    creatorId,
    creatorRelationshipId: `relationship-${index + 1}`,
    businessDeveloperIdSnapshot: index % 2 ? "bd-lena" : "bd-alex",
    creatorRelationship: {
      id: `relationship-${index + 1}`,
      creatorId,
      shopStates: [{ shopId: shop.id }],
    },
    creatorFollowerCount: creator[2],
    creatorAverageVideoViews: creator[3],
    creatorEngagementRate: creator[4],
    creatorShoppableVideoCount: creator[5],
    creatorProfile: {
      id: creatorId,
      platform: "TIKTOK",
      creatorOpenId: `open-${index + 1}`,
      creatorImId: `im-${index + 1}`,
      username: creator[0],
      nickname: creator[1],
      avatarUrl: null,
      bioDescription: null,
      profileTtUri: null,
      firstObservedAt: "2026-08-01T12:00:00.000Z",
      lastObservedAt: now,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: now,
    },
    affiliateCollaborationId: null,
    sampleApplicationRecordId,
    productId: sampleDecision ? "product-serum" : null,
    sourceWorkBoundary: null,
    affiliateCollaboration: null,
    sampleApplicationRecord: null,
    productSummary: sampleDecision
      ? {
          productId: "product-serum",
          title: "Barrier Reset Serum",
          coverImage: null,
          status: "ACTIVE",
          priceMin: "32",
          priceMax: "32",
          skus: [],
        }
      : null,
    type,
    status: "PENDING",
    operatorSummary:
      type === "SEND_MESSAGE"
        ? "Review a concise follow-up drafted by the Affiliate Agent."
        : type === "NO_ACTION_NEEDED"
          ? "Signals are healthy; keep this relationship under observation."
          : "Review the sample application against the current campaign criteria.",
    requestedByActorType: "AGENT",
    requestedByActorId: "affiliate-agent",
    revisionOfProposalId: null,
    revisionRootProposalId: proposalId,
    revisionNumber: 1,
    supersededByProposalId: null,
    revisionHistory: [],
    predictionCacheIds: [],
    predictionSnapshots: [],
    steps: [],
    policySnapshot: { action: type, requiresApproval: true, matchedPolicyIds: [], reasons: [] },
    reviewSource: "AGENT",
    humanReviewRequest: null,
    decision: null,
    messageIntent:
      type === "SEND_MESSAGE"
        ? {
            creatorId,
            creatorOpenId: `open-${index + 1}`,
            preferredChannel: "TIKTOK_IM",
            emailSubject: null,
            subjectHash: null,
            subjectLength: null,
            parts: [],
          }
        : null,
    sampleReviewIntent: sampleDecision
      ? {
          sampleApplicationRecordId,
          platformApplicationId: `platform-sample-${index + 1}`,
          reviewDispositionRevision: 1,
          executionMode: "PLATFORM_ACTION",
          decision: sampleDecision,
          rejectReason: sampleDecision === "REJECT" ? "CREATOR_NOT_ELIGIBLE" : null,
          rejectReasonExplanation: null,
        }
      : null,
    sampleShipmentIntent: null,
    creatorTagIntent: null,
    referencedManualTags: [],
    blockCreatorIntent: null,
    campaignProductUpdateIntent: null,
    approvalPolicyUpdateIntent: null,
    candidateDecisionIntent: null,
    executionResult: null,
    deliveredMessage: null,
    createdAt: new Date(Date.UTC(2026, 7, 30, 18 - index * 2, 25 - index * 3)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 30, 18 - index * 2, 40 - index * 3)).toISOString(),
    expiresAt: "2026-09-06T18:00:00.000Z",
  };
});

const entitySnapshot = {
  currentUser: {
    userId: "review-user",
    email: "review@example.com",
    name: "Review Operator",
    createdAt: "2026-01-01T00:00:00.000Z",
    enrolledModules: ["affiliate"],
    entitlementKeys: [],
    defaultRunProfileId: null,
    accountId: "review-user",
    isOwner: true,
    permissionScopes: [],
    roleName: null,
    support: null,
    agent: null,
  },
  authBootstrap: {
    status: "ready",
    phase: "settled",
    action: null,
    transitionId: 0,
    settledUserId: "review-user",
    error: null,
  },
  shops: [shop],
  providerKeys: [
    {
      id: "review-provider",
      provider: "openai",
      label: "Review provider",
      model: "gpt-5.6-terra",
      isDefault: true,
      proxyUrl: null,
      authType: "api_key",
      baseUrl: null,
      customProtocol: null,
      customModelsJson: null,
      inputModalities: null,
      source: "local",
      oauthExpiresAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: now,
      usage: null,
    },
  ],
};

const runtimeSnapshot = {
  appSettings: {
    locale: "en",
    panelTheme: theme,
    panelAccent: "blue",
    telemetryConsentShown: true,
    whatsNewLastSeenVersion: "999.0.0",
    tutorialEnabled: false,
    sidebarCollapsed: false,
  },
  csBridge: { state: "connected", reconnectAttempt: 0 },
  cloudTools: { state: "ready", lastError: "" },
  gatewayRpcConnected: true,
  openClawConnector: {},
  deviceId: "review-device",
};
const statusStreams = new Set();

function broadcastRuntimeSnapshot() {
  const event = `event: status-snapshot\ndata: ${JSON.stringify(runtimeSnapshot)}\n\n`;
  for (const stream of statusStreams) stream.write(event);
}

const businessDevelopers = [
  {
    __typename: "AffiliateBusinessDeveloper",
    id: "bd-alex",
    userId: "review-user",
    displayName: "Alex Morgan",
    creatorDisplayName: "Alex Morgan",
    normalizedDisplayName: "alex morgan",
    regions: ["US"],
    acceptingCreators: true,
    agentAssistanceMode: "ASSISTED",
    businessPrompt: null,
    profileStatus: "ACTIVE",
    provisioningSource: "MANUAL",
    profileConfirmedAt: "2026-01-01T00:00:00.000Z",
    preferredWhatsAppAccountBindingId: null,
    preferredEmailAccountBindingId: null,
    deviceId: "review-device",
    escalationChannelId: null,
    escalationRecipientId: null,
    configRevision: 1,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    __typename: "AffiliateBusinessDeveloper",
    id: "bd-lena",
    userId: "review-user",
    displayName: "Lena Ortiz",
    creatorDisplayName: "Lena Ortiz",
    normalizedDisplayName: "lena ortiz",
    regions: ["US"],
    acceptingCreators: true,
    agentAssistanceMode: "ASSISTED",
    businessPrompt: null,
    profileStatus: "ACTIVE",
    provisioningSource: "MANUAL",
    profileConfirmedAt: "2026-01-01T00:00:00.000Z",
    preferredWhatsAppAccountBindingId: null,
    preferredEmailAccountBindingId: null,
    deviceId: "review-device",
    escalationChannelId: null,
    escalationRecipientId: null,
    configRevision: 1,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

function json(response, value) {
  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function graphQlData(operationName) {
  switch (operationName) {
    case "Shops":
      return { shops: [shop] };
    case "AffiliateBusinessDevelopers":
      return { affiliateBusinessDevelopers: businessDevelopers };
    case "AffiliateBusinessDeveloperPage":
      return {
        affiliateBusinessDeveloperPage: {
          items: businessDevelopers.map((developer) => ({
            developer,
            creatorRelationshipCount: developer.id === "bd-alex" ? 5 : 3,
            whatsappAccountCount: 0,
            unhealthyWhatsappAccountCount: 0,
            emailAccountCount: 0,
            unhealthyEmailAccountCount: 0,
          })),
          totalCount: businessDevelopers.length,
          offset: 0,
          limit: 20,
        },
      };
    case "AffiliateOperationalSettings":
      return {
        affiliateOperationalSettings: {
          id: "affiliate-settings-review",
          userId: "review-user",
          onboardingCompletedAt: now,
        },
      };
    case "AffiliateCreatorProtections":
      return {
        affiliateCreatorProtections: {
          items: [],
          totalCount: 0,
          resolvedCount: 0,
          unresolvedCount: 0,
          businessDeveloperCounts: [],
          offset: 0,
          limit: 25,
        },
      };
    case "CreatorManualTags":
      return { creatorManualTags: [] };
    case "WhatsAppAccountBindings":
      return { whatsAppAccountBindings: [] };
    case "EmailAccountBindings":
      return { emailAccountBindings: [] };
    case "AffiliateApprovalPolicies":
      return { affiliateApprovalPolicies: [] };
    case "AffiliatePolicyContext":
      return {
        affiliateApprovalPolicyContext: {
          shops: [
            {
              shopId: shop.id,
              shopName: shop.shopName,
              campaigns: campaigns.map(({ id, shopId, name, status, updatedAt }) => ({
                id,
                shopId,
                name,
                status,
                updatedAt,
              })),
            },
          ],
        },
      };
    case "ActiveAnnouncements":
      return { activeAnnouncements: [] };
    case "AffiliateActionProposals":
      return {
        affiliateActionProposalPage: { items: proposals, nextCursor: null, hasMore: false },
      };
    case "AffiliateCreatorRelationshipDetail":
      return {
        affiliateCreatorRelationshipDetail: {
          includedShopIds: [shop.id],
          lastContactedAt: "2026-08-29T18:25:00.000Z",
          lastBusinessActivityAt: now,
          counts: {
            agendaItemCount: 1,
            activeSampleApplicationCount: 0,
            sampleApplicationCount: 0,
            activePlatformCollaborationCount: 0,
            platformCollaborationCount: 0,
            pendingProposalCount: 1,
            proposalCount: 1,
            lifecycleEventCount: 0,
          },
          shopActivitySummaries: [],
          creator: proposals[0].creatorProfile,
          performance: {
            id: "performance-review",
            market: "US",
            sourceShopId: shop.id,
            observedAt: now,
            sourceType: "PLATFORM",
            preciseDataAuthorized: true,
            followerCount: proposals[0].creatorFollowerCount,
            categoryIds: [],
            gmv: null,
            videoGmv: null,
            liveGmv: null,
            gpm: null,
            unitsSold: null,
            videoCount: proposals[0].creatorShoppableVideoCount,
            liveCount: null,
            averageVideoViews: proposals[0].creatorAverageVideoViews,
            engagementRate: proposals[0].creatorEngagementRate,
            pps: null,
            ratingScore: null,
            contentWindow: null,
          },
          businessDeveloper: businessDevelopers[0],
          protection: null,
          creatorRelationship: {
            id: proposals[0].creatorRelationshipId,
            creatorId: proposals[0].creatorId,
            activeSampleApplicationRecordIds: [],
            businessDeveloperId: businessDevelopers[0].id,
            operationalConfigRevision: 1,
            blocked: false,
            blockedShopIds: [],
            manualTagIds: [],
            systemTags: [],
            manualTags: [],
            highestSampleTier: null,
            lastInboundAt: null,
            lastInboundChannel: null,
            lastOutboundAt: "2026-08-29T18:25:00.000Z",
            stateUpdatedAt: now,
            committedCheckpointId: null,
            committedEventCursor: null,
            lifecycleEventSequence: 0,
            agendaItems: [],
            workSummary: {
              agentRequiredCount: 1,
              staffRequiredCount: 0,
              externalWaitingCount: 0,
              nextActionAt: null,
            },
            shopStates: [],
            updatedAt: now,
          },
        },
      };
    case "AffiliateRelationshipTimeline":
      return {
        affiliateRelationshipTimeline: {
          limit: 10,
          readAt: now,
          realItemCount: 0,
          hasOlder: false,
          olderCursor: null,
          items: [],
        },
      };
    case "AffiliateWorkbenchSamplePage":
      return {
        affiliateWorkbenchSamplePage: {
          items: [],
          hasMore: false,
          nextCursor: null,
          openCount: 0,
          expiringSoonCount: 0,
        },
      };
    case "AffiliateWorkbenchPendingConversationPage":
      return {
        affiliateWorkbenchPendingConversationPage: {
          items: [],
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
          platformCount: 0,
          whatsappCount: 0,
          emailCount: 0,
          waitingOver24hCount: 0,
        },
      };
    case "AffiliateCampaigns":
      return {
        affiliateCampaigns: campaigns.map((campaign) => ({
          __typename: "AffiliateCampaign",
          ...campaign,
          productSnapshot: campaign.productSnapshot
            ? { __typename: "AffiliateCampaignProductSnapshot", ...campaign.productSnapshot }
            : null,
          searchPlanning: {
            __typename: "AffiliateCampaignSearchPlanningState",
            ...campaign.searchPlanning,
          },
          products: campaign.products.map((product) => ({
            __typename: "AffiliateCampaignProduct",
            ...product,
          })),
          selectionPolicy: {
            __typename: "AffiliateCampaignSelectionPolicy",
            ...campaign.selectionPolicy,
          },
        })),
      };
    case "AffiliateCampaignAiReadiness":
      return {
        affiliateCampaignAiReadiness: {
          ready: true,
          status: "READY",
          modelVersion: "review-v1",
          contractVersion: "v1",
          checkedAt: now,
        },
      };
    case "AffiliateCampaignSummary":
      return {
        affiliateCampaignSummary: {
          campaignId: campaigns[0].id,
          totalCreators: 1280,
          lifetimeReachedOut: 426,
          activeDayCount: 10,
          deliveryFailureReasons: [],
          counters: {
            scanned: 1280,
            matched: 562,
            protected: 17,
            outreachPolicyBlocked: 8,
            evaluated: 537,
            qualificationFailed: 111,
            qualified: 426,
            scheduled: 426,
            submitted: 426,
            sent: 418,
            replied: 74,
            failed: 8,
            uncertain: 0,
            cancelled: 0,
          },
          shopDailyCapacity: {
            marketLocalDate: "2026-08-30",
            effectiveDailyLimit: 80,
            countedOutreachCount: 40,
            remainingOutreachCapacity: 40,
            activeCampaignDailyTargetSum: 40,
            targetToLimitRatio: 0.5,
            nextSlotAt: "2026-08-31T15:00:00.000Z",
            circuitOpenUntil: null,
            circuitReason: null,
          },
          targetCollaborationCreateQuota: null,
          latestExecution: null,
        },
      };
    case "AffiliateCampaignSelectionReadiness":
      return {
        affiliateCampaignSelectionReadiness: {
          campaignId: campaigns[0].id,
          strategy: "EXPECTED_SALES",
          ready: true,
          reasonCode: null,
          message: "Selection signals are ready.",
        },
      };
    case "AffiliateCampaignSearchPlanSummaries":
      return { affiliateCampaignSearchPlanSummaries: { items: [], nextCursor: null } };
    case "AffiliateCampaignSearchPlanCreatorStates":
      return {
        affiliateCampaignSearchPlanCreatorStates: { items: [], nextCursor: null },
      };
    case "AffiliateProductSummaries":
      return {
        affiliateProductSummaries: campaigns[0].products.map((product) => ({
          shopId: campaigns[0].shopId,
          product: {
            productId: product.productId,
            title: campaigns[0].productSnapshot.title,
            coverImage: campaigns[0].productSnapshot.coverImage,
            status: campaigns[0].productSnapshot.status,
            priceMin: campaigns[0].productSnapshot.minimumPriceUsdAmount,
            priceMax: campaigns[0].productSnapshot.maximumPriceUsdAmount,
            skus: [],
          },
        })),
      };
    case "AffiliateEscalationPage":
      return { affiliateEscalationPage: { totalCount: 0, offset: 0, limit: 25, items: [] } };
    default:
      return {};
  }
}

const server = createServer((request, response) => {
  if (request.url?.startsWith("/api/events")) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write(`event: entity-snapshot\ndata: ${JSON.stringify(entitySnapshot)}\n\n`);
    response.write(`event: status-snapshot\ndata: ${JSON.stringify(runtimeSnapshot)}\n\n`);
    statusStreams.add(response);
    const keepAlive = setInterval(() => response.write(": review\n\n"), 15_000);
    request.on("close", () => {
      statusStreams.delete(response);
      clearInterval(keepAlive);
    });
    return;
  }

  if (request.method === "PUT" && request.url?.startsWith("/api/settings")) {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const settings = JSON.parse(body);
        if (settings.panel_theme) runtimeSnapshot.appSettings.panelTheme = settings.panel_theme;
        if (settings.sidebar_collapsed) {
          runtimeSnapshot.appSettings.sidebarCollapsed = settings.sidebar_collapsed === "true";
        }
      } catch {
        // Invalid review-only settings payloads leave the fixture unchanged.
      }
      broadcastRuntimeSnapshot();
      json(response, {});
    });
    return;
  }

  if (request.url?.startsWith("/api/auth/session")) {
    json(response, { authenticated: false, tokenPresent: false });
    return;
  }

  if (request.url?.startsWith("/api/cloud/graphql")) {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      let operationName = "";
      try {
        const payload = JSON.parse(body);
        operationName =
          payload.operationName ??
          payload.query?.match(/\b(?:query|mutation)\s+([A-Za-z0-9_]+)/)?.[1] ??
          "";
      } catch {
        // An empty operation produces an empty data object below.
      }
      json(response, { data: graphQlData(operationName) });
    });
    return;
  }

  json(response, {});
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Workbench review backend (${theme}) listening on http://127.0.0.1:${port}\n`,
  );
});
