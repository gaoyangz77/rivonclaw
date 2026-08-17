import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { rootStore } from "../app/store/desktop-store.js";
import type { AffiliateWorkItemPayload } from "../cloud/backend-subscription-client.js";
import {
  computeAffiliateWorkItemDeviceTarget,
  handleAffiliateWorkItemChanged,
  type AffiliateShopDeviceFacts,
} from "./affiliate-work-item-actuator.js";

const mockHandleAffiliateWorkItemChanged = vi.fn();

vi.mock("@rivonclaw/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rivonclaw/logger")>();
  return {
    ...actual,
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  };
});

vi.mock("../gateway/connection.js", () => ({
  getCsBridge: () => ({
    handleAffiliateWorkItemChanged: mockHandleAffiliateWorkItemChanged,
  }),
}));

function ingestAffiliateShop(input: {
  id: string;
  platformShopId: string;
  enabled?: boolean;
  deviceId?: string | null;
}): void {
  rootStore.ingestGraphQLResponse({
    shops: [{
      id: input.id,
      platform: "TIKTOK_SHOP",
      platformAppId: `app-${input.id}`,
      platformShopId: input.platformShopId,
      shopName: `Shop ${input.id}`,
      alias: null,
      authStatus: "AUTHORIZED",
      region: "US",
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      services: {
        customerService: null,
        wms: null,
        affiliateService: {
          enabled: input.enabled ?? true,
          deviceId: input.deviceId ?? null,
          runProfileId: "AFFILIATE_OPERATOR",
          businessPrompt: null,
          decisionThresholds: null,
        },
      },
    }],
  });
}

interface TargetingFixture {
  businessDeveloperId?: string | null;
  businessDeveloperDeviceId?: string | null;
  /** Ordered agenda shop anchors; null models a shopless (direct-channel) item. */
  agendaShopIds?: Array<string | null>;
  /** Ordered relationship shop-state list. */
  shopStateIds?: string[];
  omitWorkSummary?: boolean;
}

function createWorkItem(fixture: TargetingFixture): AffiliateWorkItemPayload {
  return {
    id: "work-001",
    triggerShopId: "shop-001",
    triggerPlatformShopId: "platform-shop-001",
    routingShopIds: ["shop-001"],
    routingPlatformShopIds: ["platform-shop-001"],
    subjectType: GQL.AffiliateWorkItemSubjectType.CreatorRelationship,
    creatorRelationshipId: "relationship-001",
    affiliateCollaborationId: "collab-001",
    workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
    workBundleKind: GQL.AffiliateWorkBundleKind.SampleReviewOnly,
    agentDispatchRecommended: true,
    staffReviewRequired: false,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication,
    processReasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
    recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
    versionAt: "2026-05-11T00:01:00.000Z",
    agentWorkingAgendaItems: (fixture.agendaShopIds ?? []).map((shopId, index) => ({
      key: `agenda-${index}`,
      shopId,
    })),
    creatorRelationship: {
      id: "relationship-001",
      userId: "user-001",
      creatorId: "creator-001",
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication,
      processReasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
      activeAffiliateCollaborationIds: ["collab-001"],
      workSummary: fixture.omitWorkSummary
        ? null
        : {
            agentRequiredCount: 1,
            staffRequiredCount: 0,
            externalWaitingCount: 0,
            nextActionAt: null,
            businessDeveloperId: fixture.businessDeveloperId ?? null,
            businessDeveloperDeviceId: fixture.businessDeveloperDeviceId ?? null,
          },
      shopStates: (fixture.shopStateIds ?? []).map((shopId) => ({ shopId })),
      blocked: false,
      blockedShopIds: [],
      stateUpdatedAt: "2026-05-11T00:01:00.000Z",
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    },
    affiliateCollaboration: {
      id: "collab-001",
      userId: "user-001",
      shopId: "shop-001",
      campaignId: null,
      creatorIds: ["creator-001"],
      creatorOpenIds: ["creator-open-001"],
      productIds: ["product-001"],
      type: GQL.AffiliateCollaborationType.Target,
      status: GQL.AffiliateCollaborationStatus.Active,
      platformCollaborationId: "platform-collaboration-001",
      commissionRate: null,
      effectiveTime: "2026-05-11T00:00:00.000Z",
      platformUpdatedAt: "2026-05-11T00:01:00.000Z",
      firstObservedAt: "2026-05-11T00:00:00.000Z",
      lastObservedAt: "2026-05-11T00:01:00.000Z",
      lastSyncSource: GQL.AffiliateProjectionSyncSource.AirflowReconcile,
      projectionRevision: 1,
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    },
    sampleApplicationRecord: null,
    context: {
      creatorProfile: null,
      creatorRelation: null,
      activeCollaborations: [],
      ambiguousCollaborationCandidates: [],
      focusCollaboration: null,
      recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
      relatedSampleApplications: [],
      missingContext: [],
    },
  } as unknown as AffiliateWorkItemPayload;
}

/** Builds a payload-independent shop lookup from insertion-ordered entries. */
function lookupFrom(
  shops: Record<string, AffiliateShopDeviceFacts>,
): (shopId: string) => AffiliateShopDeviceFacts | undefined {
  return (shopId) => shops[shopId];
}

describe("computeAffiliateWorkItemDeviceTarget", () => {
  it("targets the Business Developer's device and ignores every shop binding", () => {
    const target = computeAffiliateWorkItemDeviceTarget(
      createWorkItem({
        businessDeveloperId: "bd-1",
        businessDeveloperDeviceId: "bd-device",
        agendaShopIds: ["shop-a"],
        shopStateIds: ["shop-a"],
      }),
      // An enabled shop with its own device exists, but a BD-routed item must
      // never consult it: the shop anchor is a technical session anchor only.
      lookupFrom({ "shop-a": { enabled: true, deviceId: "shop-device" } }),
    );
    expect(target).toEqual({ kind: "BUSINESS_DEVELOPER", deviceId: "bd-device" });
  });

  it("targets nobody when the Business Developer has no device, with no shop fallback", () => {
    for (const businessDeveloperDeviceId of [null, "", "   "]) {
      const target = computeAffiliateWorkItemDeviceTarget(
        createWorkItem({
          businessDeveloperId: "bd-1",
          businessDeveloperDeviceId,
          agendaShopIds: ["shop-a"],
          shopStateIds: ["shop-a"],
        }),
        lookupFrom({ "shop-a": { enabled: true, deviceId: "shop-device" } }),
      );
      expect(target).toEqual({ kind: "BUSINESS_DEVELOPER_WITHOUT_DEVICE" });
    }
  });

  it("targets the first agenda-anchored enabled shop with a device when no Business Developer is assigned", () => {
    const target = computeAffiliateWorkItemDeviceTarget(
      createWorkItem({
        agendaShopIds: ["shop-disabled", "shop-deviceless", "shop-b", "shop-c"],
        shopStateIds: ["shop-c", "shop-b"],
      }),
      lookupFrom({
        "shop-disabled": { enabled: false, deviceId: "device-x" },
        "shop-deviceless": { enabled: true, deviceId: null },
        "shop-b": { enabled: true, deviceId: "device-b" },
        "shop-c": { enabled: true, deviceId: "device-c" },
      }),
    );
    expect(target).toEqual({ kind: "SHOP", deviceId: "device-b", shopId: "shop-b" });
  });

  it("falls back to the relationship shop-state order only when no agenda item names a shop", () => {
    const lookup = lookupFrom({
      "shop-a": { enabled: true, deviceId: "device-a" },
      "shop-b": { enabled: true, deviceId: "device-b" },
    });

    // Anchor-less agenda (direct-channel items carry no shop): shop-state order decides.
    expect(
      computeAffiliateWorkItemDeviceTarget(
        createWorkItem({ agendaShopIds: [null, null], shopStateIds: ["shop-b", "shop-a"] }),
        lookup,
      ),
    ).toEqual({ kind: "SHOP", deviceId: "device-b", shopId: "shop-b" });

    // An anchored agenda whose shops all fail the predicate does NOT fall
    // through to the shop-state list: the work named its shops.
    expect(
      computeAffiliateWorkItemDeviceTarget(
        createWorkItem({
          agendaShopIds: ["shop-unknown"],
          shopStateIds: ["shop-a"],
        }),
        lookup,
      ),
    ).toEqual({ kind: "NO_ELIGIBLE_SHOP" });
  });

  it("targets nobody when no candidate shop is enabled with a device", () => {
    const target = computeAffiliateWorkItemDeviceTarget(
      createWorkItem({ agendaShopIds: [], shopStateIds: ["shop-a", "shop-b"] }),
      lookupFrom({
        "shop-a": { enabled: false, deviceId: "device-a" },
        "shop-b": { enabled: true, deviceId: "  " },
      }),
    );
    expect(target).toEqual({ kind: "NO_ELIGIBLE_SHOP" });
  });

  it("computes the same target on every desktop regardless of local store order", () => {
    const workItem = createWorkItem({
      agendaShopIds: ["shop-2", "shop-1"],
      shopStateIds: ["shop-1", "shop-2"],
    });
    // Two desktops holding the same shops in opposite local orders. The
    // lookup is keyed by shop id, so payload (agenda) order alone decides.
    const storeOrderOne = lookupFrom({
      "shop-1": { enabled: true, deviceId: "device-1" },
      "shop-2": { enabled: true, deviceId: "device-2" },
    });
    const storeOrderTwo = lookupFrom({
      "shop-2": { enabled: true, deviceId: "device-2" },
      "shop-1": { enabled: true, deviceId: "device-1" },
    });

    const targetOne = computeAffiliateWorkItemDeviceTarget(workItem, storeOrderOne);
    const targetTwo = computeAffiliateWorkItemDeviceTarget(workItem, storeOrderTwo);
    expect(targetOne).toEqual(targetTwo);
    expect(targetOne).toEqual({ kind: "SHOP", deviceId: "device-2", shopId: "shop-2" });
  });

  it("falls back to the shop scan when the payload predates the work summary", () => {
    const target = computeAffiliateWorkItemDeviceTarget(
      createWorkItem({ omitWorkSummary: true, agendaShopIds: ["shop-a"] }),
      lookupFrom({ "shop-a": { enabled: true, deviceId: "device-a" } }),
    );
    expect(target).toEqual({ kind: "SHOP", deviceId: "device-a", shopId: "shop-a" });
  });
});

describe("affiliate work item actuator", () => {
  beforeEach(() => {
    mockHandleAffiliateWorkItemChanged.mockReset();
    rootStore.clearCloudEntities();
  });

  it("ingests the creator relationship owner from relationship work items", async () => {
    ingestAffiliateShop({
      id: "shop-001",
      platformShopId: "platform-shop-001",
      deviceId: "device-001",
    });

    await handleAffiliateWorkItemChanged(
      "device-001",
      createWorkItem({ shopStateIds: ["shop-001"] }),
    );

    expect(rootStore.affiliateWorkspace.getCreatorRelationship("relationship-001")?.creatorId)
      .toBe("creator-001");
    expect(rootStore.affiliateWorkspace.relationshipProjection("relationship-001")?.affiliateCollaborations)
      .toHaveLength(0);
    expect(mockHandleAffiliateWorkItemChanged).toHaveBeenCalledOnce();
  });

  it("dispatches only on the agenda-anchored shop's device, resolved from the live store", async () => {
    ingestAffiliateShop({
      id: "shop-001",
      platformShopId: "platform-shop-001",
      deviceId: "device-001",
    });
    const workItem = createWorkItem({ agendaShopIds: ["shop-001"] });

    await handleAffiliateWorkItemChanged("device-001", workItem);
    expect(mockHandleAffiliateWorkItemChanged).toHaveBeenCalledWith(workItem);
  });

  it("ignores work targeted at another device without ingesting", async () => {
    ingestAffiliateShop({
      id: "shop-001",
      platformShopId: "platform-shop-001",
      deviceId: "device-001",
    });

    await handleAffiliateWorkItemChanged(
      "device-other",
      createWorkItem({ agendaShopIds: ["shop-001"] }),
    );

    expect(rootStore.affiliateWorkspace.getCreatorRelationship("relationship-001")).toBeFalsy();
    expect(mockHandleAffiliateWorkItemChanged).not.toHaveBeenCalled();
  });

  it("lets Business Developer-routed work wait when the developer is deviceless", async () => {
    ingestAffiliateShop({
      id: "shop-001",
      platformShopId: "platform-shop-001",
      deviceId: "device-001",
    });

    await handleAffiliateWorkItemChanged(
      "device-001",
      createWorkItem({
        businessDeveloperId: "bd-1",
        businessDeveloperDeviceId: null,
        agendaShopIds: ["shop-001"],
      }),
    );

    expect(rootStore.affiliateWorkspace.getCreatorRelationship("relationship-001")).toBeFalsy();
    expect(mockHandleAffiliateWorkItemChanged).not.toHaveBeenCalled();
  });

  it("dispatches Business Developer-routed work on the developer's device even with no local shop binding", async () => {
    const workItem = createWorkItem({
      businessDeveloperId: "bd-1",
      businessDeveloperDeviceId: "bd-device",
      agendaShopIds: ["shop-001"],
    });

    await handleAffiliateWorkItemChanged("bd-device", workItem);
    expect(mockHandleAffiliateWorkItemChanged).toHaveBeenCalledWith(workItem);
  });
});
