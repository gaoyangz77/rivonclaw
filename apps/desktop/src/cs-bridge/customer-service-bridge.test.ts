import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  AffiliateNewMessageFrame,
  AffiliateSampleApplicationUpdatedFrame,
} from "@rivonclaw/core";
import { GQL } from "@rivonclaw/core";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("ws", () => ({ WebSocket: vi.fn() }));
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockRpcRequest = vi.fn();
const mockEnsureRpcReady = vi.fn();
vi.mock("../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockRpcRequest(...args),
    ensureRpcReady: () => mockEnsureRpcReady(),
  },
}));

const { mockCompressImageForAgent } = vi.hoisted(() => ({
  mockCompressImageForAgent: vi.fn(),
}));
vi.mock("./image-compressor.js", () => ({
  compressImageForAgent: (...args: unknown[]) => mockCompressImageForAgent(...args),
}));

const mockGraphqlFetch = vi.fn();
const { mockGetAuthSession } = vi.hoisted(() => ({
  mockGetAuthSession: vi.fn(),
}));
vi.mock("../auth/session-ref.js", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("../gateway/provider-keys-ref.js", () => ({
  getProviderKeysStore: () => ({ getAll: () => [] }),
}));

vi.mock("../gateway/vendor-dir-ref.js", () => ({
  getVendorDir: () => "/fake/vendor",
}));

const mockReadFullModelCatalog = vi.fn().mockResolvedValue({});
vi.mock("@rivonclaw/gateway", () => ({
  readFullModelCatalog: (...args: unknown[]) => mockReadFullModelCatalog(...args),
}));

vi.mock("../affiliate/affiliate-workflow-skill.js", () => ({
  buildAffiliateWorkflowSkillCatalog: vi
    .fn()
    .mockResolvedValue(
      [
        "## Skills",
        "<available_skills>",
        "<skill>",
        "<name>affiliate-workflow</name>",
        "<version>1.0.0</version>",
        "<location>/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md</location>",
        "</skill>",
        "</available_skills>",
      ].join("\n"),
    ),
}));

const mockEmitCsTelemetry = vi.fn();
const mockEmitCsError = vi.fn();
vi.mock("../telemetry/cs-telemetry-ref.js", () => ({
  emitCsTelemetry: (...args: unknown[]) => mockEmitCsTelemetry(...args),
  emitCsError: (...args: unknown[]) => mockEmitCsError(...args),
  emitCsDeliveryRecovery: vi.fn(),
  emitCsDispatchEvent: vi.fn(),
  emitCsEscalationEvent: vi.fn(),
  emitCsSessionEvent: vi.fn(),
  CS_ERROR_STAGE: {
    DELIVER: "deliver",
    SANITIZE: "sanitize",
    RUN_ERROR: "run_error",
    DISPATCH: "dispatch",
    BACKEND_SESSION: "backend_session",
    SETUP: "setup",
    CONTEXT_RESOLUTION: "context_resolution",
    IMAGE_INGEST: "image_ingest",
    ESCALATE: "escalate",
    RELAY_CONNECT: "relay_connect",
    SHOP_BIND_REJECTED: "shop_bind_rejected",
  },
}));

vi.mock("./cs-session-cursor-store.js", () => ({
  readOpenClawSessionCursor: vi.fn(async () => ({
    messageId: "msg-seen",
    messageIndex: "1",
    createTime: 100,
  })),
  advanceOpenClawSessionCursor: vi.fn(async () => undefined),
  compareMessageCursor: vi.fn(() => 0),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { CustomerServiceBridge, type CSShopContext } from "./customer-service-bridge.js";
import { rootStore } from "../app/store/desktop-store.js";
import { applySnapshot, onAction } from "mobx-state-tree";

// Track setSessionRunProfile calls via MST's onAction middleware (no spy mutation needed)
const setSessionRunProfileCalls: Array<{ sessionKey: string; runProfileId: string | null }> = [];
onAction(
  rootStore,
  (call) => {
    if (call.name === "setSessionRunProfile") {
      setSessionRunProfileCalls.push({
        sessionKey: call.args?.[0] as string,
        runProfileId: (call.args?.[1] as string | null) ?? null,
      });
    }
  },
  true,
); // true = attach to subtree (captures actions on child models)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBridge(
  overrides?: Partial<{ defaultRunProfileId: string; locale: string }>,
): CustomerServiceBridge {
  return new CustomerServiceBridge({
    gatewayId: "test-gateway",
    defaultRunProfileId: overrides?.defaultRunProfileId ?? "CUSTOMER_SERVICE",
    locale: overrides?.locale,
  });
}

const defaultShop: CSShopContext = {
  objectId: "mongo-id-123",
  userId: "user-001",
  platformShopId: "tiktok-shop-456",
  shopName: "Test Shop",
  systemPrompt: "You are a CS assistant.",
  runProfileId: "CUSTOMER_SERVICE",
};

function buildAffiliateRelationshipWorkItem(creatorRelationshipId: string, userId = "user-001") {
  const creatorRelationship = {
    id: creatorRelationshipId,
    userId,
    creatorId: "creator-001",
    shopStates: [],
    agendaItems: [],
    workSummary: {
      agentRequiredCount: 1,
      staffRequiredCount: 0,
      externalWaitingCount: 0,
      activeCollaborationCount: 0,
      nextActionAt: null,
    },
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    committedCheckpointId: null,
    committedEventCursor: 0,
    lifecycleEventSequence: 1,
    nextSellerActionAt: null,
    lastInboundAt: "2026-07-01T12:00:00.000Z",
    lastOutboundAt: null,
    lastAgentHandledAt: null,
    lastPlatformSyncedAt: null,
    stateUpdatedAt: "2026-07-01T12:00:00.000Z",
    activeCollaborationRecordIds: [],
    blocked: false,
    blockedShopIds: [],
    lastBlockedAt: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
  };
  return {
    id: creatorRelationshipId,
    focusShopId: defaultShop.objectId,
    focusPlatformShopId: defaultShop.platformShopId,
    routingShopIds: [defaultShop.objectId],
    routingPlatformShopIds: [defaultShop.platformShopId],
    subjectType: GQL.AffiliateWorkItemSubjectType.CreatorRelationship,
    creatorRelationshipId,
    collaborationRecordId: null,
    workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
    workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyOnly,
    agentDispatchRecommended: true,
    staffReviewRequired: false,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    versionAt: "2026-07-01T12:00:00.000Z",
    creatorRelationship,
    collaboration: null,
    sampleApplicationRecord: null,
    context: {
      activeCollaborations: [],
      ambiguousCollaborationCandidates: [],
      relatedSampleApplications: [],
      missingContext: [],
      recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    },
  };
}

function buildAffiliateCreatorContactState(creatorRelationshipId: string) {
  return {
    creatorRelationship: {
      id: creatorRelationshipId,
    },
    whatsAppAccounts: [],
    emailAccounts: [],
    hasUsableWhatsAppContact: false,
    hasUsableEmailContact: false,
    preferredChannel: GQL.AffiliateMessageChannel.PlatformChat,
  };
}

type TestCSMessagePayload = {
  type: "cs_tiktok_new_message";
  shopId: string;
  conversationId: string;
  imUserId: string;
  messageId: string;
  messageType: string;
  content: string;
  senderRole: string;
  senderId: string;
  createTime: number;
  isVisible: boolean;
  orderId?: string;
};

function createFrame(overrides?: Partial<TestCSMessagePayload>): TestCSMessagePayload {
  return {
    type: "cs_tiktok_new_message",
    shopId: "tiktok-shop-456",
    conversationId: "conv-789",
    imUserId: "buyer-001",
    messageId: "msg-001",
    messageType: "TEXT",
    content: JSON.stringify({ content: "Hello" }),
    senderRole: "BUYER",
    senderId: "buyer-001",
    createTime: 1234567890,
    isVisible: true,
    ...overrides,
  };
}

const csTestFramesByMessageId = new Map<string, TestCSMessagePayload>();

function deltaTextFromFrame(frame: TestCSMessagePayload): string {
  if (frame.messageType.toUpperCase() === "TEXT") {
    try {
      const parsed = JSON.parse(frame.content) as Record<string, unknown>;
      if (typeof parsed.content === "string") return parsed.content;
      if (typeof parsed.text === "string") return parsed.text;
    } catch {
      // Use raw text below.
    }
  }
  if (frame.messageType.toUpperCase() === "IMAGE") {
    try {
      const parsed = JSON.parse(frame.content) as Record<string, unknown>;
      if (typeof parsed.url === "string") return parsed.url;
    } catch {
      // Use raw content below.
    }
  }
  return frame.content;
}

function buildTestConversationDeltaResult(currentMessageId: unknown): {
  ecommerceGetConversationMessageDelta: {
    items: Array<{
      messageId: string;
      index: string;
      type: string;
      text: string;
      createTime: number;
      sender: { role?: string; nickname: string };
    }>;
    meta: Record<string, unknown>;
  };
} {
  const frame = csTestFramesByMessageId.get(String(currentMessageId ?? ""));
  return {
    ecommerceGetConversationMessageDelta: {
      items: frame
        ? [
            {
              messageId: frame.messageId,
              index: "1",
              type: frame.messageType,
              text: deltaTextFromFrame(frame),
              createTime: frame.createTime,
              sender: { role: frame.senderRole, nickname: "Buyer" },
            },
          ]
        : [],
      meta: {
        completeness: frame ? "COMPLETE" : "CURRENT_MESSAGE_NOT_FOUND",
        anchorMatchType: "PLATFORM_MESSAGE_ID",
        currentMessageFound: Boolean(frame),
        anchorMatched: true,
        pageLimitReached: false,
        fetchedMessageCount: frame ? 1 : 0,
        anchorMessageId: "msg-seen",
        anchorCreateTime: 100,
      },
    },
  };
}

function createAffiliateFrame(
  overrides?: Partial<AffiliateNewMessageFrame>,
): AffiliateNewMessageFrame {
  return {
    type: "affiliate_tiktok_new_message",
    shopId: "tiktok-shop-456",
    conversationId: "aff-conv-789",
    imUserId: "creator-001",
    messageId: "aff-msg-001",
    messageType: "TEXT",
    content: JSON.stringify({ content: "Can you send me a sample?" }),
    senderRole: "CREATOR",
    senderId: "creator-001",
    createTime: 1234567890,
    isVisible: true,
    ...overrides,
  };
}

function createAffiliateSampleFrame(
  overrides?: Partial<AffiliateSampleApplicationUpdatedFrame>,
): AffiliateSampleApplicationUpdatedFrame {
  return {
    type: "affiliate_tiktok_sample_application_updated",
    shopId: "tiktok-shop-456",
    applicationId: "sample-app-001",
    creatorId: "creator-001",
    productId: "product-001",
    status: "PENDING_REVIEW",
    eventTime: 1234567890,
    ...overrides,
  };
}

/** Simulate the production backend signal path for a buyer message. */
async function triggerMessage(
  bridge: CustomerServiceBridge,
  frame: TestCSMessagePayload,
): Promise<void> {
  csTestFramesByMessageId.set(frame.messageId, frame);
  const shop = (bridge as any).shopContexts?.get(frame.shopId) as CSShopContext | undefined;
  const existingShop = shop
    ? rootStore.findShopByObjectOrPlatformId(shop.objectId, shop.platformShopId)
    : undefined;
  if (shop && !existingShop) {
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: shop.objectId,
          platform: shop.platform ?? "TIKTOK_SHOP",
          platformShopId: shop.platformShopId,
          shopName: shop.shopName,
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: shop.systemPrompt,
              platformSystemPrompt: shop.systemPrompt,
              runProfileId: shop.runProfileId ?? null,
              csProviderOverride: shop.csProviderOverride ?? null,
              csModelOverride: shop.csModelOverride ?? null,
            },
            affiliateService: {
              enabled: false,
              csDeviceId: null,
              runProfileId: null,
            },
          },
        },
      ],
    });
  }
  await bridge.handleCsConversationSignal({
    type: "UNREAD_DETECTED",
    source: "WEBHOOK",
    shopId: shop?.objectId ?? frame.shopId,
    platformShopId: frame.shopId,
    conversationId: frame.conversationId,
    messageId: frame.messageId,
    messageIndex: undefined,
    imUserId: frame.imUserId,
    buyerUserId: frame.imUserId,
    orderId: frame.orderId,
    messageType: frame.messageType,
    senderRole: frame.senderRole,
    aiEnabled: true,
    latestMessagePreview: deltaTextFromFrame(frame),
    eventTime: new Date(frame.createTime * 1000).toISOString(),
  });
}

/** Route an affiliate message through the domain inbound handler. */
async function triggerAffiliateMessage(
  bridge: CustomerServiceBridge,
  frame: AffiliateNewMessageFrame,
): Promise<void> {
  await (bridge as any).affiliateInbound.handleFrame(frame);
}

async function triggerAffiliateSampleEvent(
  bridge: CustomerServiceBridge,
  frame: AffiliateSampleApplicationUpdatedFrame,
): Promise<void> {
  await (bridge as any).affiliateInbound.handleFrame(frame);
}

function seedAffiliateShopContext(bridge: CustomerServiceBridge): void {
  (bridge as any).affiliateInbound.syncFromShops([
    {
      id: defaultShop.objectId,
      userId: defaultShop.userId,
      platformShopId: defaultShop.platformShopId,
      shopName: defaultShop.shopName,
      platform: "TIKTOK_SHOP",
    },
  ]);
}

function seedAffiliateShopInCache(overrides: Partial<CSShopContext> = {}): void {
  const userId = Object.prototype.hasOwnProperty.call(overrides, "userId")
    ? overrides.userId
    : defaultShop.userId;
  rootStore.ingestGraphQLResponse({
    shops: [
      {
        id: defaultShop.objectId,
        userId,
        platform: "TIKTOK_SHOP",
        platformShopId: defaultShop.platformShopId,
        shopName: defaultShop.shopName,
        services: {
          customerService: {
            enabled: false,
            csDeviceId: null,
            businessPrompt: null,
            runProfileId: null,
            platformSystemPrompt: null,
          },
          affiliateService: {
            enabled: true,
            csDeviceId: "test-gateway",
            runProfileId: "AFFILIATE_OPERATOR",
          },
        },
      },
    ],
  });
}

function setChannelManagerTestEnv(stateDir: string): void {
  rootStore.channelManager.setEnv({
    storage: {
      channelAccounts: {
        list: () => [],
        get: () => undefined,
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      channelRecipients: {
        ensureExists: vi.fn(),
        getRecipientMeta: () => ({}),
        setLabel: vi.fn(),
        delete: vi.fn(),
        setOwner: vi.fn(),
      },
      mobilePairings: { getAllPairings: () => [] },
      settings: { get: () => "1", set: vi.fn() },
    } as any,
    configPath: join(stateDir, "openclaw.json"),
    stateDir,
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  csTestFramesByMessageId.clear();
  rootStore.llmManager.clearVolatileSessionState();
  process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS = "0";
  delete process.env.RIVONCLAW_CS_IMAGE_COMPRESSION;
  applySnapshot(rootStore.toolCapability.sessionProfiles, {});
  setSessionRunProfileCalls.length = 0;
  mockRpcRequest.mockResolvedValue({ ok: true });
  mockEnsureRpcReady.mockReturnValue({ request: mockRpcRequest, isConnected: () => true });
  mockReadFullModelCatalog.mockResolvedValue({});
  mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
    if (query.includes("affiliateWorkItems")) {
      const creatorRelationshipId = variables?.input?.creatorRelationshipId;
      return {
        affiliateWorkItems: creatorRelationshipId
          ? [buildAffiliateRelationshipWorkItem(creatorRelationshipId)]
          : [],
      };
    }
    if (query.includes("affiliateContextBuilder")) {
      const creatorRelationshipId = variables?.input?.creatorRelationshipId;
      const workItem = buildAffiliateRelationshipWorkItem(creatorRelationshipId);
      return {
        affiliateContextBuilder: {
          creatorRelationship: workItem.creatorRelationship,
          baseCheckpointId: null,
          baseEventCursor: 0,
          targetEventCursor: 1,
          baseMatchesCommitted: true,
          truncated: false,
          events: [],
          workspace: {
            sampleApplicationRecords: [],
            collaborationRecords: [],
            actionProposals: [],
            approvalPolicies: [],
            creatorRelations: [],
            creatorTags: [],
            creatorProfiles: [],
            campaigns: [],
            campaignProducts: [],
            affiliateCollaborations: [],
            searchRuns: [],
            candidates: [],
          },
        },
        affiliateCreatorContactState: buildAffiliateCreatorContactState(creatorRelationshipId),
      };
    }
    if (query.includes("AffiliateCreatorMessagePreflight")) {
      return {
        affiliateCreatorMessageHistory: {
          items: [
            {
              channel:
                variables?.input?.channelFilter?.[0] ?? GQL.AffiliateMessageChannel.PlatformChat,
              direction: GQL.AffiliateCreatorMessageDirection.Creator,
              messageRef: "message-ref-test",
              parts: [{ kind: GQL.AffiliateHistoryPartKind.Text }],
              messageType: "TEXT",
              createdAt: "2026-07-01T12:00:00.000Z",
              source: "TEST",
            },
          ],
        },
      };
    }
    if (query.includes("ecommerceGetConversationDetails")) {
      return { ecommerceGetConversationDetails: { buyer: null } };
    }
    if (query.includes("affiliateWorkspace")) {
      return {
        affiliateWorkspace: {
          sampleApplicationRecords: [
            {
              id: "sample-record-001",
              platformApplicationId: variables?.input?.platformApplicationId ?? "sample-app-001",
              creatorId: null,
              productId: "product-SUB",
              sampleWorkStatus: "REQUEST_PENDING_REVIEW",
              observedContentCount: 0,
              latestObservedContentAt: null,
              latestObservedContentId: null,
              latestObservedContentUrl: null,
              latestObservedContentFormat: null,
              latestObservedContentPaidOrderCount: null,
              latestObservedContentViewCount: null,
              updatedAt: "2026-05-08T10:01:00.000Z",
            },
          ],
          collaborationRecords: [],
          actionProposals: [],
          approvalPolicies: [
            {
              id: "policy-001",
              reason: "Require approval for affiliate actions",
              action: "SEND_MESSAGE",
              enabled: true,
            },
          ],
        },
      };
    }
    if (query.includes("csGetOrCreateSession")) {
      return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
    }
    if (query.includes("ecommerceGetConversationMessageDelta")) {
      return buildTestConversationDeltaResult(variables?.currentMessageId);
    }
    return { ecommerceSendMessage: { messageId: "msg-default" } };
  });
  mockGetAuthSession.mockReturnValue({
    getAccessToken: () => "test-token",
    graphqlFetch: mockGraphqlFetch,
  });
  // Initialize LLMProviderManager env so CS dispatches can resolve a concrete model.
  const activeProviderKey = {
    id: "key-default",
    provider: "rivonclaw-pro",
    label: "RivonClaw AI",
    model: "gpt-5.5",
    isDefault: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  rootStore.llmManager.setEnv({
    storage: {
      providerKeys: {
        getAll: () => [activeProviderKey],
        getActive: () => activeProviderKey,
        getById: (id: string) => (id === activeProviderKey.id ? activeProviderKey : null),
      },
    } as any,
    secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
    getRpcClient: () => mockEnsureRpcReady() as any,
    toMstSnapshot: async () => ({}) as any,
    allKeysToMstSnapshots: async () => [],
    syncActiveKey: async () => {},
    syncAllAuthProfiles: async () => {},
    writeProxyRouterConfig: async () => {},
    writeFullGatewayConfig: async () => {},
    writeDefaultModelToConfig: () => {},
    restartGateway: async () => {},
    proxyFetch: globalThis.fetch,
    stateDir: "/tmp/test-state",
    getLastSystemProxy: () => null,
  });
  // Reset MST store, then seed RunProfiles so toolCapability.allRunProfiles returns test data
  rootStore.ingestGraphQLResponse({
    runProfiles: [
      {
        id: "CUSTOMER_SERVICE",
        name: "TikTok CS",
        userId: "",
        surfaceId: "Default",
        selectedToolIds: ["TOOL_A", "TOOL_B"],
      },
      {
        id: "AFFILIATE_OPERATOR",
        name: "Affiliate Operator",
        userId: "",
        surfaceId: "Default",
        selectedToolIds: [
          "affiliate_get_creator_relationship",
          "affiliate_resolve_work_item",
          "affiliate_decide_proposal",
        ],
      },
      {
        id: "FALLBACK_CS",
        name: "Fallback CS",
        userId: "",
        surfaceId: "Default",
        selectedToolIds: ["TOOL_C"],
      },
    ],
    surfaces: [],
    toolSpecs: [],
    shops: [],
  });
  // Platform CS prompt is now embedded per-shop as
  // `services.customerService.platformSystemPrompt`. Individual tests supply
  // the fixture value on each shop they seed (or omit it / set it to null to
  // exercise the "prompt not ready yet" path).
});

// ─── Affiliate creator-message dispatch ────────────────────────────────────

describe("affiliate message dispatch", () => {
  it("does not dispatch raw platform creator messages before relationship materialization", async () => {
    const bridge = createBridge();
    seedAffiliateShopContext(bridge);

    await triggerAffiliateMessage(bridge, createAffiliateFrame({ conversationId: "aff-conv-ABC" }));

    expect(setSessionRunProfileCalls).toHaveLength(0);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
  });

  it("drops affiliate messages when the shop is not known locally", async () => {
    const bridge = createBridge();

    await triggerAffiliateMessage(bridge, createAffiliateFrame());

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("does not dispatch sample application events before relationship materialization", async () => {
    const bridge = createBridge();
    seedAffiliateShopContext(bridge);

    await triggerAffiliateSampleEvent(bridge, createAffiliateSampleFrame());

    expect(setSessionRunProfileCalls).toHaveLength(0);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("does not dispatch raw sample application frames even when they include a relationship id", async () => {
    const bridge = createBridge();
    seedAffiliateShopContext(bridge);

    await triggerAffiliateSampleEvent(
      bridge,
      createAffiliateSampleFrame({
        creatorRelationshipId: "relationship-from-frame",
      }),
    );

    expect(setSessionRunProfileCalls).toHaveLength(0);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("dispatches backend affiliate creator-message signals through the subscription path", async () => {
    const bridge = createBridge();
    seedAffiliateShopInCache();
    mockRpcRequest.mockResolvedValue({ runId: "run-aff-sub" });

    await bridge.handleAffiliateRelationshipSignal({
      type: "AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED",
      source: "WEBHOOK",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      conversationId: "aff-conv-SUB",
      messageId: "aff-msg-SUB",
      creatorRelationshipId: "relationship-SUB",
      messageType: "TEXT",
      creatorImId: "creator-im-SUB",
      eventTime: "2026-05-08T10:00:00.000Z",
    } as any);

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:affiliate:affiliate:user-001:relationship-SUB",
      runProfileId: "AFFILIATE_OPERATOR",
    });
    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateWorkItems"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: defaultShop.objectId,
          creatorRelationshipId: "relationship-SUB",
        }),
      }),
    );
    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateContextBuilder"),
      expect.objectContaining({
        input: expect.objectContaining({
          creatorRelationshipId: "relationship-SUB",
          baseEventCursor: 0,
        }),
      }),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:affiliate:affiliate:user-001:relationship-SUB",
        idempotencyKey: expect.stringContaining(
          "affiliate:tiktok:work:INBOUND_MESSAGE_TRIAGE:relationship-SUB",
        ),
        message: expect.stringContaining("[Agent Working Agenda]"),
        extraSystemPrompt: expect.stringContaining(
          "/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
        ),
      }),
    );
  });

  it("dispatches relationship-scoped WhatsApp affiliate signals without a platform conversation id", async () => {
    const bridge = createBridge();
    seedAffiliateShopInCache();
    mockRpcRequest.mockResolvedValue({ runId: "run-aff-whatsapp" });

    await bridge.handleAffiliateRelationshipSignal({
      type: "AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED",
      source: "WEBHOOK",
      workSignal: true,
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      creatorRelationshipId: "relationship-001",
      messageId: "wamid-001",
      messageType: "conversation",
      channel: "WHATSAPP",
      messageDirection: "CREATOR",
      eventTime: "2026-07-01T12:00:00.000Z",
    } as any);

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:affiliate:affiliate:user-001:relationship-001",
      runProfileId: "AFFILIATE_OPERATOR",
    });
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:affiliate:affiliate:user-001:relationship-001",
        idempotencyKey: expect.stringContaining(
          "affiliate:tiktok:work:INBOUND_MESSAGE_TRIAGE:relationship-001",
        ),
        message: expect.stringContaining("[Agent Working Agenda]"),
        extraSystemPrompt: expect.stringContaining(
          "/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
        ),
      }),
    );
    expect(
      mockGraphqlFetch.mock.calls.some(
        ([query]) => typeof query === "string" && query.includes("affiliateRelationshipTimeline"),
      ),
    ).toBe(false);
  });

  it("uses the backend relationship owner when cached shop context omits a user id", async () => {
    const bridge = createBridge();
    seedAffiliateShopInCache({ userId: undefined } as Partial<CSShopContext>);
    mockRpcRequest.mockResolvedValue({ runId: "run-aff-signal-user" });
    mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
      const creatorRelationshipId = variables?.input?.creatorRelationshipId;
      const workItem = buildAffiliateRelationshipWorkItem(creatorRelationshipId, "signal-user-007");
      if (query.includes("affiliateWorkItems")) {
        return { affiliateWorkItems: [workItem] };
      }
      if (query.includes("affiliateContextBuilder")) {
        return {
          affiliateContextBuilder: {
            creatorRelationship: workItem.creatorRelationship,
            baseCheckpointId: null,
            baseEventCursor: 0,
            targetEventCursor: 1,
            baseMatchesCommitted: true,
            truncated: false,
            events: [],
            workspace: {
              sampleApplicationRecords: [],
              collaborationRecords: [],
              actionProposals: [],
              approvalPolicies: [],
              creatorRelations: [],
              creatorTags: [],
              creatorProfiles: [],
              campaigns: [],
              campaignProducts: [],
              affiliateCollaborations: [],
              searchRuns: [],
              candidates: [],
            },
          },
          affiliateCreatorContactState: buildAffiliateCreatorContactState(creatorRelationshipId),
        };
      }
      if (query.includes("AffiliateCreatorMessagePreflight")) {
        return {
          affiliateCreatorMessageHistory: {
            items: [
              {
                channel: GQL.AffiliateMessageChannel.Whatsapp,
                direction: GQL.AffiliateCreatorMessageDirection.Creator,
                messageRef: "message-ref-signal-user",
                parts: [{ kind: GQL.AffiliateHistoryPartKind.Text }],
                messageType: "TEXT",
                createdAt: "2026-07-01T12:05:00.000Z",
                source: "TEST",
              },
            ],
          },
        };
      }
      return {};
    });

    await bridge.handleAffiliateRelationshipSignal({
      type: "AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED",
      source: "WEBHOOK",
      workSignal: true,
      userId: "signal-user-007",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      creatorRelationshipId: "relationship-SIGNAL-USER",
      messageId: "wamid-signal-user",
      messageType: "conversation",
      channel: "WHATSAPP",
      messageDirection: "CREATOR",
      eventTime: "2026-07-01T12:05:00.000Z",
    } as any);

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:affiliate:affiliate:signal-user-007:relationship-SIGNAL-USER",
      }),
    );
  });

  it("dispatches one agent run when repeated signals resolve to the same work item version", async () => {
    const bridge = createBridge();
    seedAffiliateShopInCache();
    mockRpcRequest.mockResolvedValue({ runId: "run-aff-race" });
    const signal = {
      type: "AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED",
      source: "WEBHOOK",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      conversationId: "aff-conv-RACE",
      messageId: "aff-msg",
      creatorRelationshipId: "relationship-RACE",
      messageType: "TEXT",
      creatorImId: "creator-im-SUB",
      eventTime: "2026-05-08T10:00:00.000Z",
    } as any;
    await bridge.handleAffiliateRelationshipSignal(signal);
    await bridge.handleAffiliateRelationshipSignal(signal);

    const agentCalls = mockRpcRequest.mock.calls.filter((call: unknown[]) => call[0] === "agent");
    expect(agentCalls).toHaveLength(1);
  });

  it("uses sample signals only to refresh relationship work projection", async () => {
    const bridge = createBridge();
    seedAffiliateShopInCache();

    await bridge.handleAffiliateRelationshipSignal({
      type: "AFFILIATE_SAMPLE_APPLICATION_OBSERVED",
      source: "AIRFLOW",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      platformApplicationId: "sample-app-SUB",
      creatorRelationshipId: "relationship-SAMPLE",
      platformStatus: "AWAITING_SHIPMENT",
      productId: "product-SUB",
      eventTime: "2026-05-08T10:01:00.000Z",
    } as any);

    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateWorkItems"),
      expect.objectContaining({
        input: expect.objectContaining({
          creatorRelationshipId: "relationship-SAMPLE",
        }),
      }),
    );
  });
});

// ─── 1. Shop context management ─────────────────────────────────────────────

describe("shop context management", () => {
  it("setShopContext stores context keyed by platformShopId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Prove context is stored: onNewMessage should find it and proceed
    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).toHaveBeenCalled();
  });

  it("removeShopContext removes the stored context", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    bridge.removeShopContext("tiktok-shop-456");

    await triggerMessage(bridge, createFrame());
    // Should drop: no RPC calls, no profile set
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("drops message when shop context not found", async () => {
    const bridge = createBridge();
    // No shop context set

    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("proceeds when shop context is found", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());
    expect(mockRpcRequest).toHaveBeenCalledTimes(2);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
        provider: "rivonclaw-pro",
        model: "gpt-5.5",
      }),
      120000,
    );
  });
});

// ─── 2. Session key construction ────────────────────────────────────────────

describe("session key construction", () => {
  it("uses the canonical customer-service agent key for registration", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-ABC" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-ABC",
      }),
    );
  });

  it("uses the same canonical key for agent dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-ABC" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-ABC",
      }),
      120000,
    );
  });

  it("setSessionRunProfile receives scopeKey", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-XYZ" }));

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-XYZ",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("uses shop.platform for session keys when provided", async () => {
    const bridge = createBridge();
    bridge.setShopContext({ ...defaultShop, platform: "shopee" });

    await triggerMessage(bridge, createFrame({ conversationId: "conv-PLAT" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:shopee:mongo-id-123:conv-PLAT",
      }),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:shopee:mongo-id-123:conv-PLAT",
        idempotencyKey: "cs-start:conv-PLAT:msg-001",
      }),
      120000,
    );
  });

  it("defaults platform to 'tiktok' when shop.platform is undefined", async () => {
    const bridge = createBridge();
    // defaultShop has no platform field
    bridge.setShopContext({ ...defaultShop, platform: undefined });

    await triggerMessage(bridge, createFrame({ conversationId: "conv-DEF" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-DEF",
      }),
    );
  });
});

// ─── 3a. Image attachment extraction ─────────────────────────────────────────

describe("image attachment extraction", () => {
  it("cloud IMAGE delta: fetches current buyer image URL and passes base64 attachment to agent RPC", async () => {
    const fakeImageBuffer = Buffer.from("fake-delta-image-data");
    const imageUrl = "https://p16-oec-general-useast5.ttcdn-us.com/tos/test-image~origin-jpeg.jpeg";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: () =>
        Promise.resolve(
          fakeImageBuffer.buffer.slice(
            fakeImageBuffer.byteOffset,
            fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength,
          ),
        ),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
      if (query.includes("csGetOrCreateSession")) {
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      }
      if (query.includes("ecommerceGetConversationMessageDelta")) {
        return {
          ecommerceGetConversationMessageDelta: {
            items: [
              {
                messageId: variables?.currentMessageId ?? "msg-image",
                index: "1779000000000001",
                type: "IMAGE",
                text: imageUrl,
                createTime: 1779000001,
                sender: { role: "BUYER", nickname: "Alice" },
              },
            ],
            meta: {
              completeness: "COMPLETE",
              anchorMatchType: "PLATFORM_MESSAGE_ID",
              currentMessageFound: true,
              anchorMatched: true,
              pageLimitReached: false,
              fetchedMessageCount: 1,
              anchorMessageId: "msg-seen",
              anchorCreateTime: 1779000000,
            },
          },
        };
      }
      return { ecommerceSendMessage: { messageId: "msg-default" } };
    });

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-delta-image",
      buyerUserId: "buyer-001",
    });

    await session.dispatchCatchUp({
      currentMessageId: "msg-image",
      messageType: "IMAGE",
      currentMessageCursor: {
        messageId: "msg-image",
        messageIndex: "1779000000000001",
        createTime: 1779000001,
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(imageUrl);
    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    expect(agentCall![1].attachments).toEqual([
      { mimeType: "image/jpeg", content: fakeImageBuffer.toString("base64") },
    ]);
    expect(mockCompressImageForAgent).not.toHaveBeenCalled();
    expect(agentCall![1].message).toContain("type: IMAGE");
    expect(agentCall![1].message).toContain("[Image attached to this agent run]");
    expect(agentCall![1].message).not.toContain(imageUrl);

    vi.unstubAllGlobals();
  });

  it("cloud IMAGE delta: compression is opt-in and uses the compressed attachment when enabled", async () => {
    process.env.RIVONCLAW_CS_IMAGE_COMPRESSION = "1";
    const rawImageBuffer = Buffer.from("raw-delta-image-data");
    const compressedImageBuffer = Buffer.from("small");
    mockCompressImageForAgent.mockResolvedValue({
      ok: true,
      compressed: true,
      buffer: compressedImageBuffer,
      mimeType: "image/jpeg",
    });
    const imageUrl = "https://p16-oec-general-useast5.ttcdn-us.com/tos/test-image~origin-jpeg.jpeg";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: () =>
        Promise.resolve(
          rawImageBuffer.buffer.slice(
            rawImageBuffer.byteOffset,
            rawImageBuffer.byteOffset + rawImageBuffer.byteLength,
          ),
        ),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
      if (query.includes("csGetOrCreateSession")) {
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      }
      if (query.includes("ecommerceGetConversationMessageDelta")) {
        return {
          ecommerceGetConversationMessageDelta: {
            items: [
              {
                messageId: variables?.currentMessageId ?? "msg-image",
                index: "1779000000000001",
                type: "IMAGE",
                text: imageUrl,
                createTime: 1779000001,
                sender: { role: "BUYER", nickname: "Alice" },
              },
            ],
            meta: {
              completeness: "COMPLETE",
              anchorMatchType: "PLATFORM_MESSAGE_ID",
              currentMessageFound: true,
              anchorMatched: true,
              pageLimitReached: false,
              fetchedMessageCount: 1,
              anchorMessageId: "msg-seen",
              anchorCreateTime: 1779000000,
            },
          },
        };
      }
      return { ecommerceSendMessage: { messageId: "msg-default" } };
    });

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-delta-image-compressed",
      buyerUserId: "buyer-001",
    });

    await session.dispatchCatchUp({
      currentMessageId: "msg-image",
      messageType: "IMAGE",
      currentMessageCursor: {
        messageId: "msg-image",
        messageIndex: "1779000000000001",
        createTime: 1779000001,
      },
    });

    expect(mockCompressImageForAgent).toHaveBeenCalledWith(rawImageBuffer, "image/png");
    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    expect(agentCall?.[1].attachments).toEqual([
      { mimeType: "image/jpeg", content: compressedImageBuffer.toString("base64") },
    ]);

    vi.unstubAllGlobals();
  });
});

// ─── 4. CS RunProfile setup ─────────────────────────────────────────────────

describe("CS RunProfile setup", () => {
  it("calls setSessionRunProfile with scopeKey, profile data, and runProfileId", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("proceeds with agent dispatch even when RunProfile not in cache (model resolves at query time)", async () => {
    rootStore.ingestGraphQLResponse({ runProfiles: [] }); // no profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Bridge no longer validates profile existence — it stores the ID and lets the model
    // resolve at effective-tools query time (returning empty tools if not found).
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything(), 120000);
    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("falls back to defaultRunProfileId when shop has no runProfileId", async () => {
    const bridge = createBridge({ defaultRunProfileId: "FALLBACK_CS" });
    bridge.setShopContext({ ...defaultShop, runProfileId: undefined });

    await triggerMessage(bridge, createFrame());

    expect(setSessionRunProfileCalls).toContainEqual(
      expect.objectContaining({
        runProfileId: "FALLBACK_CS",
      }),
    );
  });

  it("refreshes RunProfile binding before dispatch when an existing session lost it", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ messageId: "msg-1" }));

    rootStore.toolCapability.setSessionRunProfile(
      "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
      null,
    );
    setSessionRunProfileCalls.length = 0;
    mockRpcRequest.mockClear();

    await triggerMessage(bridge, createFrame({ messageId: "msg-2" }));

    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything(), 120000);
    expect(setSessionRunProfileCalls).toContainEqual({
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
      runProfileId: "CUSTOMER_SERVICE",
    });
  });

  it("drops message when no runProfileId and no defaultRunProfileId", async () => {
    const bridge = new CustomerServiceBridge({
      gatewayId: "test-gateway",
      // no defaultRunProfileId
    });
    bridge.setShopContext({ ...defaultShop, runProfileId: undefined });

    await triggerMessage(bridge, createFrame());

    // Missing RunProfile fails setup before gateway registration/agent dispatch.
    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(setSessionRunProfileCalls).toHaveLength(0);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });
});

// ─── 5. Session registration ────────────────────────────────────────────────

describe("session registration", () => {
  it("cs_register_session called with correct scopeKey and csContext", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(
      bridge,
      createFrame({
        conversationId: "conv-100",
        imUserId: "buyer-200",
      }),
    );

    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", {
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-100",
      csContext: {
        shopId: "mongo-id-123",
        conversationId: "conv-100",
        buyerUserId: "buyer-200",
        imUserId: "buyer-200",
        orderId: null,
        recentOrders: [],
      },
    });
  });

  it("csContext contains shop.objectId, not platform ID", async () => {
    const bridge = createBridge();
    bridge.setShopContext({
      objectId: "actual-mongo-object-id",
      platformShopId: "platform-id-999",
      shopName: "Test Shop",
      systemPrompt: "prompt",
    });

    await triggerMessage(bridge, createFrame({ shopId: "platform-id-999" }));

    const registerCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "cs_register_session",
    );
    expect(registerCall).toBeDefined();
    expect(registerCall![1].csContext.shopId).toBe("actual-mongo-object-id");
  });

  it("csContext includes orderId when orders are returned from backend", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceGetConversationDetails")) {
          return {
            ecommerceGetConversationDetails: { buyer: { userId: "buyer-001", nickname: "Buyer" } },
          };
        }
        if (query.includes("ecommerceGetOrders")) {
          return { ecommerceGetOrders: [{ orderId: "order-555", createTime: 1700000000 }] };
        }
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      },
    );

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "cs_register_session",
      expect.objectContaining({
        csContext: expect.objectContaining({ orderId: "order-555" }),
      }),
    );
  });

  it("if registration fails, message is dropped (no RunProfile set, no agent dispatch)", async () => {
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "cs_register_session") throw new Error("registration failed");
      return { ok: true, messages: [] };
    });
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    // No RunProfile set should have been called
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });
});

// ─── 6. Agent dispatch ──────────────────────────────────────────────────────

describe("agent dispatch", () => {
  it("agent RPC called with dispatchKey as sessionKey", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ conversationId: "conv-dispatch" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-dispatch",
      }),
      120000,
    );
  });

  it("extraSystemPrompt includes shop.systemPrompt and session info", async () => {
    const bridge = createBridge();
    bridge.setShopContext({
      ...defaultShop,
      systemPrompt: "Custom shop prompt for testing.",
    });

    await triggerMessage(
      bridge,
      createFrame({
        conversationId: "conv-prompt",
        imUserId: "buyer-prompt",
      }),
    );

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    const prompt = agentCall![1].extraSystemPrompt as string;
    expect(prompt).toContain("Image generation and image editing are not available");
    expect(prompt).toContain("Custom shop prompt for testing.");
    expect(prompt).toContain("conv-prompt");
    expect(prompt).toContain("buyer-prompt");
    expect(prompt).toContain("mongo-id-123");
    expect(prompt).toContain(
      "Reply in the buyer's language. Avoid Markdown styling; short hyphen bullets are OK.",
    );
    expect(prompt).toContain("highest-priority");
    expect(prompt).toContain("overrides general customer-service and store instructions");
  });

  it("dispatchCatchUp appends operator instruction as a separate internal block", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-operator",
    });

    await session.dispatchCatchUp({
      operatorInstruction:
        "This refund request looks unreasonable. Review carefully and do not promise compensation unless the evidence supports it.",
    });

    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    const message = agentCall?.[1].message as string;
    expect(message).toContain("[Internal: System]");
    expect(message).toContain("ecom_cs_get_conversation_messages");
    expect(message).toContain("Follow the operator instruction");
    expect(message).toContain("Use the current tool specs as the source of truth");
    expect(message).toContain("Use the provided dispatch context and local session context");
    expect(message).toContain("[Internal: Operator Instruction]");
    expect(message).toContain("This refund request looks unreasonable.");
  });

  it("dispatchCatchUp skips platform delta when no local OpenClaw session anchor exists", async () => {
    const cursorStore = await import("./cs-session-cursor-store.js");
    vi.mocked(cursorStore.readOpenClawSessionCursor).mockResolvedValueOnce(undefined);
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "chat.history") return { messages: [] };
      return { ok: true, runId: "run-new-cs-session" };
    });

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-new-session",
    });

    await session.dispatchCatchUp({
      currentMessageId: "msg-new-session",
    });

    expect(mockGraphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ecommerceGetConversationMessageDelta"),
      expect.anything(),
    );
    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    const message = agentCall?.[1].message as string;
    expect(message).toContain("[Internal: System]");
    expect(message).toContain("ecom_cs_get_conversation_messages");
    expect(message).not.toContain("[Customer Service Conversation Work Package]");
  });

  it("dispatchCatchUp strips local cursor metadata before requesting platform delta", async () => {
    const cursorStore = await import("./cs-session-cursor-store.js");
    vi.mocked(cursorStore.readOpenClawSessionCursor).mockResolvedValueOnce({
      messageId: "msg-seen",
      messageIndex: "1779000000000000",
      createTime: 1779000000,
      sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-delta",
      runId: "run-local",
      updatedAt: "2026-05-23T00:00:00.000Z",
    });
    mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
      if (query.includes("csGetOrCreateSession")) {
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      }
      if (query.includes("ecommerceGetConversationMessageDelta")) {
        expect(variables?.anchor).toEqual({
          messageId: "msg-seen",
          messageIndex: "1779000000000000",
          createTime: 1779000000,
        });
        return {
          ecommerceGetConversationMessageDelta: {
            items: [
              {
                messageId: "msg-current",
                index: "1779000000000001",
                type: "TEXT",
                text: "Where is my order?",
                createTime: 1779000001,
                sender: { role: "BUYER", nickname: "Alice" },
              },
            ],
            meta: {
              completeness: "COMPLETE",
              anchorMatchType: "PLATFORM_MESSAGE_ID",
              currentMessageFound: true,
              anchorMatched: true,
              pageLimitReached: false,
              fetchedMessageCount: 1,
              anchorMessageId: "msg-seen",
              anchorCreateTime: 1779000000,
            },
          },
        };
      }
      return { ecommerceSendMessage: { messageId: "msg-default" } };
    });

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-delta",
    });

    await session.dispatchCatchUp({ currentMessageId: "msg-current" });

    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    const message = agentCall?.[1].message as string;
    expect(message).toContain("[Customer Service Conversation Work Package]");
    expect(message).toContain("Where is my order?");
  });

  it("handleCsConversationSignal passes operator instruction into catch-up dispatch", async () => {
    const bridge = createBridge();
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: defaultShop.objectId,
          platform: "TIKTOK_SHOP",
          platformShopId: defaultShop.platformShopId,
          shopName: defaultShop.shopName,
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: defaultShop.systemPrompt,
              runProfileId: defaultShop.runProfileId,
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });

    await bridge.handleCsConversationSignal({
      type: "MANUAL_START",
      source: "MANUAL",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      conversationId: "conv-manual",
      orderId: "order-manual",
      operatorInstruction: "This user's request is unreasonable; do not offer a refund.",
      eventTime: new Date().toISOString(),
    } as any);

    const agentCall = mockRpcRequest.mock.calls.findLast((c: any[]) => c[0] === "agent");
    const message = agentCall?.[1].message as string;
    expect(message).toContain("[Internal: Operator Instruction]");
    expect(message).toContain("This user's request is unreasonable");
  });

  it("handleCsConversationSignal skips dispatch when conversation AI is disabled", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await bridge.handleCsConversationSignal({
      type: "MESSAGE_RECEIVED",
      source: "WEBHOOK",
      shopId: defaultShop.objectId,
      platformShopId: defaultShop.platformShopId,
      conversationId: "conv-disabled",
      aiEnabled: false,
      eventTime: new Date().toISOString(),
    } as any);

    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("extraSystemPrompt includes orderId when present", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceGetConversationDetails")) {
          return {
            ecommerceGetConversationDetails: { buyer: { userId: "buyer-001", nickname: "Buyer" } },
          };
        }
        if (query.includes("ecommerceGetOrders")) {
          return { ecommerceGetOrders: [{ orderId: "order-in-prompt", createTime: 1700000000 }] };
        }
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      },
    );

    await triggerMessage(bridge, createFrame());

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("order-in-prompt");
  });

  it("extraSystemPrompt omits Order ID line when orderId is absent", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ orderId: undefined }));

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).not.toContain("Order ID");
  });

  it("idempotencyKey = cs-start:{conversationId}:{messageId}", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ messageId: "msg-unique-42" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        idempotencyKey: "cs-start:conv-789:msg-unique-42",
      }),
      120000,
    );
  });

  it("if dispatch fails, error is logged but bridge continues running", async () => {
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") throw new Error("agent dispatch failed");
      if (method === "chat.history") return { messages: [] };
      return { ok: true };
    });

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Should not throw
    await triggerMessage(bridge, createFrame({ messageId: "msg-fail" }));

    expect(mockRpcRequest).toHaveBeenCalledTimes(2);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything(), 120000);
  });
});

// ─── 7. Error scenarios ─────────────────────────────────────────────────────

describe("error scenarios", () => {
  it("no RPC client → message dropped entirely", async () => {
    mockRpcRequest.mockRejectedValue(new Error("OpenClawConnector: RPC client not connected"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // cs_register_session is attempted but fails; no further calls happen
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("shop context not found → message dropped with no further calls", async () => {
    const bridge = createBridge();
    // Do NOT set any shop context

    await triggerMessage(bridge, createFrame({ shopId: "nonexistent-shop" }));

    expect(mockRpcRequest).not.toHaveBeenCalled();
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("session registration fails → RunProfile set and agent dispatch skipped", async () => {
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "cs_register_session") throw new Error("session reg failed");
      return { ok: true, messages: [] };
    });
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expect(mockRpcRequest).toHaveBeenCalledTimes(1);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(setSessionRunProfileCalls).toHaveLength(0);
  });

  it("RunProfile not in cache → bridge still proceeds (model resolves at query time)", async () => {
    rootStore.ingestGraphQLResponse({ runProfiles: [] }); // empty profiles
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // Bridge no longer validates profile existence — it stores the ID.
    expect(mockRpcRequest).toHaveBeenCalledTimes(2);
    expect(mockRpcRequest).toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith("agent", expect.anything(), 120000);
  });

  it("agent dispatch fails → bridge does not throw (continues running)", async () => {
    mockRpcRequest
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("dispatch failure"));
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    // Must not throw
    await expect(triggerMessage(bridge, createFrame())).resolves.toBeUndefined();
  });

  it("multiple shops: messages route to correct shop context", async () => {
    const bridge = createBridge();
    const shopA: CSShopContext = {
      objectId: "mongo-A",
      platformShopId: "platform-A",
      shopName: "Shop A",
      systemPrompt: "Prompt A",
    };
    const shopB: CSShopContext = {
      objectId: "mongo-B",
      platformShopId: "platform-B",
      shopName: "Shop B",
      systemPrompt: "Prompt B",
    };
    bridge.setShopContext(shopA);
    bridge.setShopContext(shopB);

    await triggerMessage(bridge, createFrame({ shopId: "platform-B" }));

    const registerCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "cs_register_session",
    );
    expect(registerCall![1].csContext.shopId).toBe("mongo-B");

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].extraSystemPrompt).toContain("Prompt B");
  });
});

// ── 8. Reactive entity cache sync ──────────────────────────────────────────

describe("reactive entity cache sync", () => {
  it("syncFromCache picks up CS-enabled shops bound to this device", () => {
    const bridge = createBridge();

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "My Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "You are a CS agent.",
              csModelOverride: null,
              runProfileId: "rp-1",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    // Verify the shop context is set by triggering a message
    const frame = createFrame({ shopId: "ps-1" });
    return triggerMessage(bridge, frame).then(() => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({
          csContext: expect.objectContaining({ shopId: "shop-1" }),
        }),
      );
    });
  });

  it("syncFromCache skips shops not bound to this device", () => {
    const bridge = createBridge();

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Other Device Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "other-device",
              businessPrompt: "prompt",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    // Should not have context for this shop
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache skips shops with CS disabled", () => {
    const bridge = createBridge();

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Disabled Shop",
          services: {
            customerService: {
              enabled: false,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt",
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache skips shops when platform prompt has not been fetched yet", () => {
    const bridge = createBridge();

    // Platform prompt is embedded per-shop on `platformSystemPrompt`. When
    // it is null (e.g. the shop payload arrived before the backend's
    // service-prompt cache was populated), the computed `assembledPrompt`
    // view returns null and the bridge should skip the shop.
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "No Prompt Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "",
              platformSystemPrompt: null,
            },
          },
        },
      ],
    });

    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache keeps existing CS context while shop lifecycle is refreshing", () => {
    const bridge = createBridge();

    // First: add a shop context manually
    bridge.setShopContext({
      objectId: "shop-1",
      platformShopId: "ps-1",
      shopName: "Test Shop",
      platform: "tiktok",
      systemPrompt: "Old prompt",
    });

    // Then: sync while the shop lifecycle is loading. Failed/in-flight refreshes
    // must not make CS silently drop buyer-message dispatches; a successful
    // empty shop response still removes the context.
    rootStore.beginShopRefresh("test_refresh");
    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({
          csContext: expect.objectContaining({ shopId: "shop-1" }),
        }),
      );
    });
  });

  it("syncFromCache removes existing CS context when the shop is explicitly disabled", () => {
    const bridge = createBridge();

    bridge.setShopContext({
      objectId: "shop-1",
      platformShopId: "ps-1",
      shopName: "Test Shop",
      platform: "tiktok",
      systemPrompt: "Old prompt",
    });

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Disabled Shop",
          services: {
            customerService: {
              enabled: false,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).not.toHaveBeenCalled();
    });
  });

  it("syncFromCache updates existing shop context when data changes", () => {
    const bridge = createBridge();

    // Initial sync
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "Old prompt",
              runProfileId: null,
              csModelOverride: null,
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    // Update: change assembledPrompt
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "Updated prompt",
              runProfileId: null,
              csModelOverride: null,
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    // Trigger message and verify the updated prompt is used
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
      expect(agentCall![1].extraSystemPrompt).toContain("Updated prompt");
    });
  });

  it("syncFromCache normalizes platform name from enum", () => {
    const bridge = createBridge();

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(() => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({
          sessionKey: "agent:customer-service:cs:tiktok:shop-1:conv-789",
        }),
      );
    });
  });

  it("syncFromCache handles multiple shops with mixed eligibility", () => {
    const bridge = createBridge();

    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "shop-1",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-1",
          shopName: "Eligible",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt-1",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
        {
          id: "shop-2",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-2",
          shopName: "Disabled",
          services: {
            customerService: {
              enabled: false,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt-2",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
        {
          id: "shop-3",
          platform: "SHOPEE_STORE",
          platformShopId: "ps-3",
          shopName: "Other Device",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "other-device",
              businessPrompt: "prompt-3",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
        {
          id: "shop-4",
          platform: "TIKTOK_SHOP",
          platformShopId: "ps-4",
          shopName: "Also Eligible",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "prompt-4",
              platformSystemPrompt: "PLATFORM CS PROMPT",
            },
          },
        },
      ],
    });
    bridge.syncFromCache();

    // Only shop-1 and shop-4 should be active. Verify shop-1 works:
    return triggerMessage(bridge, createFrame({ shopId: "ps-1" })).then(async () => {
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({ csContext: expect.objectContaining({ shopId: "shop-1" }) }),
      );

      // Reset and verify shop-4 works:
      vi.clearAllMocks();
      setSessionRunProfileCalls.length = 0;
      mockRpcRequest.mockResolvedValue({ ok: true });
      mockEnsureRpcReady.mockReturnValue({ request: mockRpcRequest, isConnected: () => true });
      mockGetAuthSession.mockReturnValue({
        getAccessToken: () => "test-token",
        graphqlFetch: mockGraphqlFetch,
      });
      mockGraphqlFetch.mockResolvedValue({
        csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 },
      });
      // RunProfiles are already in the MST store from beforeEach

      await triggerMessage(bridge, createFrame({ shopId: "ps-4", conversationId: "conv-shop4" }));
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "cs_register_session",
        expect.objectContaining({ csContext: expect.objectContaining({ shopId: "shop-4" }) }),
      );
    });
  });
});

// ─── 9. CS session lifecycle ────────────────────────────────────────────────

describe("CS session lifecycle", () => {
  it("calls csGetOrCreateSession before agent dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(
      bridge,
      createFrame({
        conversationId: "conv-lifecycle",
        imUserId: "buyer-lifecycle",
      }),
    );

    // graphqlFetch should have been called with the session creation mutation
    expect(mockGraphqlFetch).toHaveBeenCalledWith(expect.stringContaining("csGetOrCreateSession"), {
      shopId: "mongo-id-123",
      conversationId: "conv-lifecycle",
    });
  });

  it("reuses the backend session marker for later buyer messages in the same conversation", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(
      bridge,
      createFrame({
        conversationId: "conv-reopened",
        messageId: "msg-before-end",
      }),
    );
    await triggerMessage(
      bridge,
      createFrame({
        conversationId: "conv-reopened",
        messageId: "msg-after-end",
      }),
    );

    const sessionCalls = mockGraphqlFetch.mock.calls.filter(
      ([query]) => typeof query === "string" && query.includes("csGetOrCreateSession"),
    );
    expect(sessionCalls).toHaveLength(1);
    expect(sessionCalls[0]).toEqual([
      expect.stringContaining("csGetOrCreateSession"),
      {
        shopId: "mongo-id-123",
        conversationId: "conv-reopened",
      },
    ]);
  });

  it("skips agent dispatch when csGetOrCreateSession fails (insufficient balance)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockClear();
    // Reject ALL graphqlFetch calls so ensureBackendSession always fails
    mockGraphqlFetch.mockRejectedValue(new Error("Insufficient balance"));

    await triggerMessage(bridge, createFrame());

    // ensureBackendSession fails before setup, so neither cs_register_session nor agent is called
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
  });

  it("skips agent dispatch when no auth session available", async () => {
    mockGetAuthSession.mockReturnValue(null);

    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    // ensureBackendSession fails (no auth), so neither cs_register_session nor agent is called
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(mockGraphqlFetch).not.toHaveBeenCalled();
  });
});

// ─── 10. Admin directive dispatch ────────────────────────────────────────────

const defaultDirectiveParams = {
  shopId: "mongo-id-123",
  conversationId: "conv-directive-001",
  buyerUserId: "buyer-001",
  decision: "approved",
  instructions: "Issue a full refund for order #12345",
};

describe("escalation lifecycle (resolve + dispatch)", () => {
  /** Helper: create a session with a pre-existing escalation. */
  async function setupSessionWithEscalation(bridge: ReturnType<typeof createBridge>) {
    bridge.setShopContext(defaultShop);
    const session = await bridge.getOrCreateSession(
      defaultDirectiveParams.shopId,
      defaultDirectiveParams,
    );
    // Simulate a prior cs_escalate by adding an escalation record
    const esc = session.addEscalation({ reason: "Refund exceeds limit" });
    return { session, escalationId: esc.id };
  }

  it("resolves escalation and dispatches notification to CS agent", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-001" });

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "Process refund",
      resolved: true,
    });
    const result = await session.dispatchEscalationResolved(escalationId);

    expect(result.runId).toBe("run-esc-001");
    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall).toBeDefined();
    // Message tells agent to use tool, not the directive itself
    expect(agentCall![1].message).toContain(escalationId);
    expect(agentCall![1].message).toContain("cs_get_escalation_result");
    expect(agentCall![1].message).toContain("Highest Priority Manager Instruction");
    expect(agentCall![1].message).toContain("produce the required buyer-facing response");
  });

  it("stores decision in escalation record", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    session.resolveEscalation(escalationId, {
      decision: "rejected",
      instructions: "Offer store credit",
      resolved: true,
    });

    const esc = session.escalations.get(escalationId);
    expect(esc?.result).toEqual(
      expect.objectContaining({
        decision: "rejected",
        instructions: "Offer store credit",
        resolved: true,
      }),
    );
    expect(esc?.result?.resolvedAt).toBeGreaterThan(0);
  });

  it("throws when resolving non-existent escalation", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const session = await bridge.getOrCreateSession(
      defaultDirectiveParams.shopId,
      defaultDirectiveParams,
    );

    expect(() =>
      session.resolveEscalation("esc_nonexistent", {
        decision: "approved",
        instructions: "go",
        resolved: true,
      }),
    ).toThrow("Escalation esc_nonexistent not found");
  });

  it("allows overwriting previous resolution", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    session.resolveEscalation(escalationId, {
      decision: "checking warehouse",
      instructions: "hold on",
      resolved: false,
    });
    const firstResolvedAt = session.escalations.get(escalationId)!.result!.resolvedAt;

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "ship replacement",
      resolved: true,
    });
    const esc = session.escalations.get(escalationId)!;

    expect(esc.result!.decision).toBe("approved");
    expect(esc.result!.instructions).toBe("ship replacement");
    expect(esc.result!.resolved).toBe(true);
    expect(esc.result!.resolvedAt).toBeGreaterThanOrEqual(firstResolvedAt);
  });

  it("registers CS session before dispatch", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-002" });

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "go",
      resolved: true,
    });
    await session.dispatchEscalationResolved(escalationId);

    const callOrder = mockRpcRequest.mock.calls.map((c: any[]) => c[0]);
    expect(callOrder.indexOf("cs_register_session")).toBeLessThan(callOrder.indexOf("agent"));
  });

  it("tracks run in pendingRuns for auto-forward", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-003" });

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "go",
      resolved: true,
    });
    await session.dispatchEscalationResolved(escalationId);

    // Simulate agent events: assistant text + lifecycle end (per-turn forwarding)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-esc-003", stream: "assistant", data: { text: "Done." } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-esc-003", stream: "lifecycle", data: { phase: "end" } },
    } as any);

    // Flush the collectUsageSnapshot → sessions.describe → graphqlFetch microtask
    // chain before asserting on mockGraphqlFetch.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.objectContaining({ shopId: "mongo-id-123", conversationId: "conv-directive-001" }),
    );
  });

  it("findSessionByEscalationId returns correct session", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    expect(bridge.findSessionByEscalationId(escalationId)).toBe(session);
    expect(bridge.findSessionByEscalationId("nonexistent")).toBeUndefined();
  });

  it("idempotencyKey starts with 'esc-resolved:' prefix", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-004" });

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "go",
      resolved: true,
    });
    await session.dispatchEscalationResolved(escalationId);

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    expect(agentCall![1].idempotencyKey).toMatch(new RegExp(`^esc-resolved:${escalationId}:\\d+$`));
  });

  it("dispatch message differs for resolved vs in-progress", async () => {
    const bridge = createBridge();

    // Test in-progress message
    const { session: session1, escalationId: eid1 } = await setupSessionWithEscalation(bridge);
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-ip-001" });
    session1.resolveEscalation(eid1, {
      decision: "checking",
      instructions: "hold",
      resolved: false,
    });
    await session1.dispatchEscalationResolved(eid1);

    const inProgressCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "agent" && c[1].message.includes(eid1),
    );
    expect(inProgressCall![1].message).toContain("sent an update");
    expect(inProgressCall![1].message).not.toContain("has been resolved");

    // Test resolved message — use a fresh bridge to avoid call interference
    const bridge2 = createBridge();
    const { session: session2, escalationId: eid2 } = await setupSessionWithEscalation(bridge2);
    mockRpcRequest.mockClear();
    mockRpcRequest.mockResolvedValue({ runId: "run-esc-res-001" });
    session2.resolveEscalation(eid2, { decision: "approved", instructions: "go", resolved: true });
    await session2.dispatchEscalationResolved(eid2);

    const resolvedCall = mockRpcRequest.mock.calls.find(
      (c: any[]) => c[0] === "agent" && c[1].message.includes(eid2),
    );
    expect(resolvedCall![1].message).toContain("has been resolved");
    expect(resolvedCall![1].message).toContain(
      "overrides general customer-service and store guidance",
    );
    expect(resolvedCall![1].message).not.toContain("sent an update");
  });

  it("GET escalation returns guidance for pending escalation", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    const escalation = session.escalations.get(escalationId)!;
    // Pending: no result set
    expect(escalation.result).toBeUndefined();

    // Verify the status derivation logic matches route handler
    const status = escalation.result?.resolved
      ? "resolved"
      : escalation.result
        ? "in_progress"
        : "pending";
    expect(status).toBe("pending");
    const guidance = !escalation.result?.resolved
      ? "This escalation is still being processed. Continue to reassure the buyer and avoid making commitments. If the buyer is pressing, you may cs_escalate again to follow up with the manager."
      : null;
    expect(guidance).not.toBeNull();
  });

  it("GET escalation returns guidance for in-progress (resolved=false) escalation", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    session.resolveEscalation(escalationId, {
      decision: "checking warehouse",
      instructions: "hold on",
      resolved: false,
    });
    const escalation = session.escalations.get(escalationId)!;

    const status = escalation.result?.resolved
      ? "resolved"
      : escalation.result
        ? "in_progress"
        : "pending";
    expect(status).toBe("in_progress");
    const guidance = !escalation.result?.resolved
      ? "This escalation is still being processed. Continue to reassure the buyer and avoid making commitments. If the buyer is pressing, you may cs_escalate again to follow up with the manager."
      : null;
    expect(guidance).not.toBeNull();
  });

  it("GET escalation returns no guidance for resolved escalation", async () => {
    const bridge = createBridge();
    const { session, escalationId } = await setupSessionWithEscalation(bridge);

    session.resolveEscalation(escalationId, {
      decision: "approved",
      instructions: "refund issued",
      resolved: true,
    });
    const escalation = session.escalations.get(escalationId)!;

    const status = escalation.result?.resolved
      ? "resolved"
      : escalation.result
        ? "in_progress"
        : "pending";
    expect(status).toBe("resolved");
    const guidance = !escalation.result?.resolved
      ? "This escalation is still being processed. Continue to reassure the buyer and avoid making commitments. If the buyer is pressing, you may cs_escalate again to follow up with the manager."
      : null;
    expect(guidance).toBeNull();
  });
});

// ─── 11. Multi-provider model override (via LLMProviderManager) ──────────────
//
// Model resolution is delegated to rootStore.llmManager.resolveModelForDispatch.
// The LLM manager reads csProviderOverride/csModelOverride from the MST shop entity
// (not from bridge's CSShopContext), so we seed shops in the MST store.

describe("multi-provider model override", () => {
  function expectDispatchedModel(provider: string, model: string): void {
    expect(mockRpcRequest).not.toHaveBeenCalledWith("sessions.patch", expect.anything());
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
        provider,
        model,
      }),
      120000,
    );
  }

  /** Helper: seed the model catalog on the LLM manager and seed a shop into MST store. */
  async function seedCatalogAndShop(overrides?: {
    csProviderOverride?: string | null;
    csModelOverride?: string | null;
  }): Promise<void> {
    // Seed model catalog on LLM manager
    mockReadFullModelCatalog.mockResolvedValue({
      zhipu: [{ id: "glm-5" }, { id: "glm-4" }],
      openai: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }],
      anthropic: [{ id: "claude-sonnet-4-20250514" }],
    });
    await rootStore.llmManager.refreshModelCatalog();

    // Seed shop in MST store with CS overrides (LLM manager reads from here)
    rootStore.ingestGraphQLResponse({
      shops: [
        {
          id: "mongo-id-123",
          platform: "TIKTOK_SHOP",
          platformShopId: "tiktok-shop-456",
          shopName: "Test Shop",
          services: {
            customerService: {
              enabled: true,
              csDeviceId: "test-gateway",
              businessPrompt: "You are a CS assistant.",
              platformSystemPrompt: "You are a CS assistant.",
              csProviderOverride: overrides?.csProviderOverride ?? null,
              csModelOverride: overrides?.csModelOverride ?? null,
              runProfileId: "CUSTOMER_SERVICE",
            },
          },
        },
      ],
    });
  }

  it("two-field override: sends provider/model directly with the agent run", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "glm-5" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expectDispatchedModel("zhipu", "glm-5");
  });

  it("two-field override: falls back to active default when provider/model not in catalog", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "nonexistent-model" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expectDispatchedModel("rivonclaw-pro", "gpt-5.5");
  });

  it("no override: dispatches with the active default", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: null, csModelOverride: null });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expectDispatchedModel("rivonclaw-pro", "gpt-5.5");
  });

  it("refreshModelCatalog caches all providers, not just active provider", async () => {
    const bridge = createBridge();
    // Seed with OpenAI model override
    await seedCatalogAndShop({ csProviderOverride: "openai", csModelOverride: "gpt-4o" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expectDispatchedModel("openai", "gpt-4o");
  });

  it("provider set without model: dispatches with active default", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: null });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame());

    expectDispatchedModel("rivonclaw-pro", "gpt-5.5");
  });

  it("refreshes an existing CS session when the shop model override changes", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "glm-5" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ messageId: "msg-model-1" }));

    expectDispatchedModel("zhipu", "glm-5");

    await seedCatalogAndShop({ csProviderOverride: "openai", csModelOverride: "gpt-4o" });
    mockRpcRequest.mockClear();

    await triggerMessage(bridge, createFrame({ messageId: "msg-model-2" }));

    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expectDispatchedModel("openai", "gpt-4o");
  });

  it("clears an existing CS session model override when the shop returns to global default", async () => {
    const bridge = createBridge();
    await seedCatalogAndShop({ csProviderOverride: "zhipu", csModelOverride: "glm-5" });
    bridge.setShopContext(defaultShop);

    await triggerMessage(bridge, createFrame({ messageId: "msg-model-default-1" }));

    expectDispatchedModel("zhipu", "glm-5");

    await seedCatalogAndShop({ csProviderOverride: null, csModelOverride: null });
    mockRpcRequest.mockClear();

    await triggerMessage(bridge, createFrame({ messageId: "msg-model-default-2" }));

    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expectDispatchedModel("rivonclaw-pro", "gpt-5.5");
  });
});

// ── 12. Escalation ───────────────────────────────────────────────────────────

const escalationShop: CSShopContext = {
  objectId: "shop-esc-001",
  platformShopId: "plat-esc-001",
  shopName: "Escalation Test Shop",
  systemPrompt: "You are a CS assistant.",
  runProfileId: "CUSTOMER_SERVICE",
};

const defaultEscalateParams = {
  shopId: "shop-esc-001",
  conversationId: "conv-esc-001",
  buyerUserId: "buyer-esc-001",
  imUserId: "buyer-esc-001",
  reason: "Buyer requesting refund beyond policy",
};

/** Seed a shop into the MST store with escalation routing configured. */
function seedShopWithEscalation(overrides?: {
  shopId?: string;
  escalationChannelId?: string | null;
  escalationRecipientId?: string | null;
}): void {
  const shopId = overrides?.shopId ?? "shop-esc-001";
  rootStore.ingestGraphQLResponse({
    shops: [
      {
        __typename: "Shop",
        id: shopId,
        platform: "tiktok",
        platformAppId: "",
        platformShopId: "plat-esc-001",
        shopName: "Escalation Test Shop",
        authStatus: "active",
        region: "US",
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        services: {
          customerService: {
            enabled: true,
            businessPrompt: "",
            csDeviceId: null,
            csProviderOverride: null,
            csModelOverride: null,
            escalationChannelId:
              overrides?.escalationChannelId !== undefined
                ? overrides.escalationChannelId
                : "telegram:acct_test123",
            escalationRecipientId:
              overrides?.escalationRecipientId !== undefined
                ? overrides.escalationRecipientId
                : "987654321",
            runProfileId: null,
          },
        },
      },
    ],
  });
}

describe("escalate", () => {
  it("sends to correct channel + accountId + recipient parsed from escalationChannelId", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    const result = await session.escalate({ reason: defaultEscalateParams.reason });

    expect(result.ok).toBe(true);
    expect(result.escalationId).toBeDefined();
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "987654321",
        channel: "telegram",
        accountId: "acct_test123",
      }),
    );
  });

  it("sends a Feishu form card while leaving other channels on the text adapter", async () => {
    seedShopWithEscalation({
      escalationChannelId: "feishu:acct_feishu",
      escalationRecipientId: "ou_manager",
    });
    const bridge = createBridge({ locale: "zh" });
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    const result = await session.escalate({ reason: defaultEscalateParams.reason });

    expect(result.ok).toBe(true);
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "message.action",
      expect.objectContaining({
        channel: "feishu",
        action: "send",
        accountId: "acct_feishu",
        params: expect.objectContaining({
          to: "ou_manager",
          card: expect.objectContaining({ schema: "2.0" }),
        }),
      }),
    );
    const request = mockRpcRequest.mock.calls.find((call) => call[0] === "message.action")?.[1];
    expect(JSON.stringify(request?.params?.card)).toContain("客服升级请求");
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("handles cloud escalation-created events with a direct outbound send, not an agent run", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    await bridge.executeCsEscalationEvent({
      escalation: {
        id: "esc_cloud_001",
        shopId: defaultEscalateParams.shopId,
        conversationId: defaultEscalateParams.conversationId,
        buyerUserId: defaultEscalateParams.buyerUserId,
        orderId: null,
        reason: defaultEscalateParams.reason,
        context: null,
        version: 1,
        status: "PENDING",
      },
      event: {
        id: "csevt_cloud_001",
        type: "ESCALATION_CREATED",
        status: "PENDING",
        decision: null,
        instructions: null,
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:00:00.000Z",
      },
    });

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "987654321",
        channel: "telegram",
        accountId: "acct_test123",
        idempotencyKey: "cs-escalate:esc_cloud_001",
      }),
    );
    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("escalation message contains reason and session details", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    await session.escalate({ reason: defaultEscalateParams.reason });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("CS Escalation");
    expect(message).toContain("Escalation ID: esc_");
    expect(message).toContain("Reason: Buyer requesting refund beyond policy");
    expect(message).toContain("Please reply with your decision");
  });

  it("escalation message contains orderId when provided", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(defaultEscalateParams.shopId, {
      ...defaultEscalateParams,
      orderId: "order-esc-999",
    });
    await session.escalate({ reason: defaultEscalateParams.reason });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("Escalation ID: esc_");
  });

  it("escalation message contains context when provided", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    await session.escalate({
      reason: defaultEscalateParams.reason,
      context: "Buyer has been waiting 3 days",
    });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    const message = sendCall![1].message as string;
    expect(message).toContain("Context: Buyer has been waiting 3 days");
  });

  it("returns error when escalation routing not configured (missing escalationChannelId)", async () => {
    seedShopWithEscalation({ escalationChannelId: null });
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session1 = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    const result = await session1.escalate({ reason: defaultEscalateParams.reason });

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("returns error when escalation routing not configured (missing escalationRecipientId)", async () => {
    seedShopWithEscalation({ escalationRecipientId: null });
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session2 = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    const result = await session2.escalate({ reason: defaultEscalateParams.reason });

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("returns error when shop not found in MST store", async () => {
    // Don't seed any shop — rootStore.shops is empty (reset in beforeEach)
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session3 = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    const result = await session3.escalate({ reason: defaultEscalateParams.reason });

    expect(result).toEqual({ ok: false, error: "Escalation routing not configured" });
    expect(mockRpcRequest).not.toHaveBeenCalledWith("send", expect.anything());
  });

  it("throws when no RPC client available", async () => {
    mockRpcRequest.mockRejectedValue(new Error("OpenClawConnector: RPC client not connected"));
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    await expect(session.escalate({ reason: defaultEscalateParams.reason })).rejects.toThrow(
      "OpenClawConnector: RPC client not connected",
    );
  });

  it("send RPC is called with correct idempotencyKey format", async () => {
    seedShopWithEscalation();
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    await session.escalate({ reason: defaultEscalateParams.reason });

    const sendCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "send");
    expect(sendCall).toBeDefined();
    expect(sendCall![1].idempotencyKey).toMatch(/^cs-escalate:esc_[a-f0-9]+:\d+$/);
  });

  it("parses channel with multiple colons correctly (accountId may contain colons)", async () => {
    seedShopWithEscalation({ escalationChannelId: "slack:workspace:channel_id" });
    const bridge = createBridge();
    bridge.setShopContext(escalationShop);

    const session = await bridge.getOrCreateSession(
      defaultEscalateParams.shopId,
      defaultEscalateParams,
    );
    await session.escalate({ reason: defaultEscalateParams.reason });

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        channel: "slack",
        accountId: "workspace:channel_id",
      }),
    );
  });

  it("sends WeChat escalation even before the recipient has a cached context token", async () => {
    const tmpStateDir = mkdtempSync(join(tmpdir(), "rivonclaw-weixin-context-test-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    setChannelManagerTestEnv(tmpStateDir);

    try {
      seedShopWithEscalation({
        escalationChannelId: "openclaw-weixin:acct_test123",
        escalationRecipientId: "manager@im.wechat",
      });
      const bridge = createBridge();
      bridge.setShopContext(escalationShop);

      const session = await bridge.getOrCreateSession(
        defaultEscalateParams.shopId,
        defaultEscalateParams,
      );
      const result = await session.escalate({ reason: defaultEscalateParams.reason });

      expect(result.ok).toBe(true);
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "manager@im.wechat",
          channel: "openclaw-weixin",
          accountId: "acct_test123",
        }),
      );
    } finally {
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(tmpStateDir, { recursive: true, force: true });
    }
  });

  it("does not require WeChat context tokens before sending escalation", async () => {
    const tmpStateDir = mkdtempSync(join(tmpdir(), "rivonclaw-weixin-context-test-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    setChannelManagerTestEnv(tmpStateDir);

    try {
      seedShopWithEscalation({
        escalationChannelId: "openclaw-weixin:acct_test123",
        escalationRecipientId: "manager@im.wechat",
      });
      const bridge = createBridge();
      bridge.setShopContext(escalationShop);

      const session = await bridge.getOrCreateSession(
        defaultEscalateParams.shopId,
        defaultEscalateParams,
      );
      const firstResult = await session.escalate({ reason: defaultEscalateParams.reason });
      expect(firstResult.ok).toBe(true);

      const accountsDir = join(tmpStateDir, "openclaw-weixin", "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(
        join(accountsDir, "acct_test123.context-tokens.json"),
        JSON.stringify({ "manager@im.wechat": "context-token" }),
      );

      const secondResult = await session.escalate({ reason: defaultEscalateParams.reason });
      expect(secondResult.ok).toBe(true);
      rootStore.channelManager.recordRecipientSeen({
        channelId: "openclaw-weixin",
        accountId: "acct_test123",
        recipientId: "manager@im.wechat",
      });

      const thirdResult = await session.escalate({ reason: defaultEscalateParams.reason });
      expect(thirdResult.ok).toBe(true);
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "manager@im.wechat",
          channel: "openclaw-weixin",
          accountId: "acct_test123",
        }),
      );
    } finally {
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(tmpStateDir, { recursive: true, force: true });
    }
  });

  it("reloads WeChat context tokens after recipient-seen when the token file lands slightly later", async () => {
    vi.useFakeTimers();
    const tmpStateDir = mkdtempSync(join(tmpdir(), "rivonclaw-weixin-context-test-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    setChannelManagerTestEnv(tmpStateDir);

    try {
      seedShopWithEscalation({
        escalationChannelId: "openclaw-weixin:acct_test123",
        escalationRecipientId: "manager@im.wechat",
      });
      const bridge = createBridge();
      bridge.setShopContext(escalationShop);
      const session = await bridge.getOrCreateSession(
        defaultEscalateParams.shopId,
        defaultEscalateParams,
      );

      rootStore.channelManager.recordRecipientSeen({
        channelId: "openclaw-weixin",
        accountId: "acct_test123",
        recipientId: "manager@im.wechat",
      });
      expect(
        rootStore.channelManager.hasWeixinContextTokenForRecipient(
          "acct_test123",
          "manager@im.wechat",
        ),
      ).toBe(false);

      const accountsDir = join(tmpStateDir, "openclaw-weixin", "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(
        join(accountsDir, "acct_test123.context-tokens.json"),
        JSON.stringify({ "manager@im.wechat": "context-token" }),
      );

      await vi.advanceTimersByTimeAsync(100);
      expect(
        rootStore.channelManager.getWeixinContextTokenForRecipient(
          "acct_test123",
          "manager@im.wechat",
        ),
      ).toBe("context-token");

      const result = await session.escalate({ reason: defaultEscalateParams.reason });
      expect(result.ok).toBe(true);
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "manager@im.wechat",
          channel: "openclaw-weixin",
          accountId: "acct_test123",
        }),
      );
    } finally {
      rootStore.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: () => [],
            get: () => undefined,
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath: join(tmpStateDir, "openclaw.json"),
        stateDir: tmpStateDir,
      });
      vi.useRealTimers();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(tmpStateDir, { recursive: true, force: true });
    }
  });

  it("sends WeChat escalation when the recipient context token is cached", async () => {
    const tmpStateDir = mkdtempSync(join(tmpdir(), "rivonclaw-weixin-context-test-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    setChannelManagerTestEnv(tmpStateDir);

    try {
      const accountsDir = join(tmpStateDir, "openclaw-weixin", "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(
        join(accountsDir, "acct_test123.context-tokens.json"),
        JSON.stringify({ "manager@im.wechat": "context-token" }),
      );
      rootStore.channelManager.recordRecipientSeen({
        channelId: "openclaw-weixin",
        accountId: "acct_test123",
        recipientId: "manager@im.wechat",
      });
      seedShopWithEscalation({
        escalationChannelId: "openclaw-weixin:acct_test123",
        escalationRecipientId: "manager@im.wechat",
      });
      const bridge = createBridge();
      bridge.setShopContext(escalationShop);

      const session = await bridge.getOrCreateSession(
        defaultEscalateParams.shopId,
        defaultEscalateParams,
      );
      const result = await session.escalate({ reason: defaultEscalateParams.reason });

      expect(result.ok).toBe(true);
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "manager@im.wechat",
          channel: "openclaw-weixin",
          accountId: "acct_test123",
        }),
      );
    } finally {
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(tmpStateDir, { recursive: true, force: true });
    }
  });

  it("sends WeChat escalation when a legacy raw accountId points at a canonical context token file", async () => {
    const tmpStateDir = mkdtempSync(join(tmpdir(), "rivonclaw-weixin-context-test-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    setChannelManagerTestEnv(tmpStateDir);

    try {
      const accountsDir = join(tmpStateDir, "openclaw-weixin", "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(
        join(accountsDir, "acct_test123-im-bot.context-tokens.json"),
        JSON.stringify({ "manager@im.wechat": "context-token" }),
      );
      rootStore.channelManager.recordRecipientSeen({
        channelId: "openclaw-weixin",
        accountId: "acct_test123@im.bot",
        recipientId: "manager@im.wechat",
      });
      seedShopWithEscalation({
        escalationChannelId: "openclaw-weixin:acct_test123@im.bot",
        escalationRecipientId: "manager@im.wechat",
      });
      const bridge = createBridge();
      bridge.setShopContext(escalationShop);

      const session = await bridge.getOrCreateSession(
        defaultEscalateParams.shopId,
        defaultEscalateParams,
      );
      const result = await session.escalate({ reason: defaultEscalateParams.reason });

      expect(result.ok).toBe(true);
      expect(mockRpcRequest).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "manager@im.wechat",
          channel: "openclaw-weixin",
          accountId: "acct_test123-im-bot",
        }),
      );
    } finally {
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(tmpStateDir, { recursive: true, force: true });
    }
  });
});

// ─── 13. Rapid buyer message handling (abort + redispatch) ────────────────────

describe("rapid buyer messages (abort + redispatch)", () => {
  /**
   * These tests simulate rapid consecutive buyer messages to verify:
   * - Active runs are aborted when new messages arrive
   * - Aborted runs don't auto-forward to buyer
   * - Only the latest message triggers the final agent run
   * - No concurrent dispatches on the same session
   */

  /** Make the agent RPC return controllable promises (queue-based for concurrent calls). */
  function createControllableRpc() {
    const agentResolvers: Array<(val: { runId: string }) => void> = [];

    mockRpcRequest.mockImplementation((method: string) => {
      if (method === "agent") {
        return new Promise<{ runId: string }>((resolve) => {
          agentResolvers.push(resolve);
        });
      }
      if (method === "chat.abort") return Promise.resolve({ aborted: true });
      if (method === "cs_register_session") return Promise.resolve(true);
      if (method === "sessions.patch") return Promise.resolve(true);
      return Promise.resolve({ ok: true });
    });

    return {
      get pendingCount() {
        return agentResolvers.length;
      },
      /** Resolve the oldest pending agent RPC. */
      resolveNext(runId: string) {
        const resolve = agentResolvers.shift();
        resolve?.({ runId });
      },
    };
  }

  it("two messages: first is aborted, second dispatches, only second auto-forwards", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const ctrl = createControllableRpc();

    // Message A → dispatch starts, agent RPC in flight
    const promiseA = triggerMessage(bridge, createFrame({ messageId: "msg-A" }));

    // Wait a tick for A's async operations (ensureBackendSession) to proceed
    await new Promise((r) => setTimeout(r, 10));

    // Message B → should abort A and dispatch B
    const promiseB = triggerMessage(bridge, createFrame({ messageId: "msg-B" }));

    // Resolve A's agent RPC (returns "run-A")
    ctrl.resolveNext("run-A");
    await promiseA;

    // Wait for B's async operations
    await new Promise((r) => setTimeout(r, 10));

    // Resolve B's agent RPC
    ctrl.resolveNext("run-B");
    await promiseB;

    // chat.abort should have been called (for A's placeholder)
    expect(mockRpcRequest).toHaveBeenCalledWith("chat.abort", expect.anything());

    // Simulate agent events for run-A (completed before abort arrived)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "assistant", data: { text: "Stale response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    // Chat final for cleanup
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-A", state: "final" },
    } as any);

    // run-A was aborted — should NOT auto-forward
    expect(mockGraphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.objectContaining({ content: expect.stringContaining("Stale response") }),
    );

    // Simulate agent events for run-B (per-turn forwarding)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "assistant", data: { text: "Correct response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "lifecycle", data: { phase: "end" } },
    } as any);

    // Flush the collectUsageSnapshot → sessions.describe → graphqlFetch microtask
    // chain before asserting on mockGraphqlFetch.
    await Promise.resolve();
    await Promise.resolve();

    // run-B should auto-forward
    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.objectContaining({ content: expect.stringContaining("Correct response") }),
    );
  });

  it("message during active run aborts it (chat.abort called)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-first" });

    // First message dispatches normally
    await triggerMessage(bridge, createFrame({ messageId: "msg-1" }));

    // Second message should trigger abort
    await triggerMessage(bridge, createFrame({ messageId: "msg-2" }));

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "chat.abort",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-789",
      }),
    );
  });

  it("aborted run error event does not auto-forward", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-aborted" });

    // First message
    await triggerMessage(bridge, createFrame({ messageId: "msg-1" }));

    // Second message aborts first
    mockRpcRequest.mockResolvedValue({ runId: "run-replacement" });
    await triggerMessage(bridge, createFrame({ messageId: "msg-2" }));

    // Gateway sends error for aborted run
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-aborted", state: "error" },
    } as any);

    // Should not forward anything
    expect(mockGraphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.anything(),
    );
  });

  it("single message (no abort) dispatches and auto-forwards normally", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-single" });

    await triggerMessage(bridge, createFrame({ messageId: "msg-only" }));

    // Should dispatch agent
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        message: expect.stringContaining("Hello"),
      }),
      120000,
    );

    // No abort should have been called
    expect(mockRpcRequest).not.toHaveBeenCalledWith("chat.abort", expect.anything());

    // Auto-forward works via agent events (per-turn forwarding)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-single", stream: "assistant", data: { text: "Reply" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-single", stream: "lifecycle", data: { phase: "end" } },
    } as any);

    // Flush the collectUsageSnapshot → sessions.describe → graphqlFetch microtask
    // chain before asserting on mockGraphqlFetch.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockGraphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ecommerceSendMessage"),
      expect.objectContaining({ content: expect.stringContaining("Reply") }),
    );
  });

  it("placeholder bail-out: earlier message bails when newer message took over", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const ctrl = createControllableRpc();

    // A starts dispatching
    const promiseA = triggerMessage(bridge, createFrame({ messageId: "msg-A" }));
    await new Promise((r) => setTimeout(r, 10));

    // B arrives and takes over
    const promiseB = triggerMessage(bridge, createFrame({ messageId: "msg-B" }));
    await new Promise((r) => setTimeout(r, 10));

    // C arrives and takes over from B
    const promiseC = triggerMessage(bridge, createFrame({ messageId: "msg-C" }));

    // Resolve all pending agent RPCs
    ctrl.resolveNext("run-A");
    await promiseA;
    await new Promise((r) => setTimeout(r, 10));

    ctrl.resolveNext("run-B");
    await promiseB;
    await new Promise((r) => setTimeout(r, 10));

    ctrl.resolveNext("run-C");
    await promiseC;

    // Only the final response (run-C) should auto-forward via agent events
    // run-A: agent text + lifecycle end (aborted, should not forward)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "assistant", data: { text: "A response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-A", state: "final" },
    } as any);

    // run-B: agent text + lifecycle end (aborted, should not forward)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "assistant", data: { text: "B response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-B", state: "final" },
    } as any);

    // run-C: agent text + lifecycle end (active, should forward)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-C", stream: "assistant", data: { text: "C response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-C", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-C", state: "final" },
    } as any);

    // Flush the collectUsageSnapshot → sessions.describe → graphqlFetch microtask
    // chain before asserting on mockGraphqlFetch.
    await Promise.resolve();
    await Promise.resolve();

    // Only C's response should be forwarded
    const forwardCalls = mockGraphqlFetch.mock.calls.filter(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("ecommerceSendMessage"),
    );
    expect(forwardCalls).toHaveLength(1);
    expect(forwardCalls[0][1].content).toContain("C response");
  });

  it("cloud catch-up snapshots: newer buyer message aborts an in-flight dispatch", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    const ctrl = createControllableRpc();
    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-cloud-rapid",
      buyerUserId: "buyer-001",
    });

    const promiseA = session.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-A",
      currentMessageCursor: { messageId: "msg-A", messageIndex: "1", createTime: 100 },
      useMessageDelta: false,
    });
    await new Promise((r) => setTimeout(r, 10));

    const promiseB = session.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-B",
      currentMessageCursor: { messageId: "msg-B", messageIndex: "2", createTime: 101 },
      latestMessagePreview: "Latest buyer message",
      source: "backend_subscription",
      useMessageDelta: false,
    });

    ctrl.resolveNext("run-A");
    await promiseA;
    await new Promise((r) => setTimeout(r, 10));

    ctrl.resolveNext("run-B");
    await promiseB;

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "chat.abort",
      expect.objectContaining({
        sessionKey: "agent:customer-service:cs:tiktok:mongo-id-123:conv-cloud-rapid",
      }),
    );

    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "assistant", data: { text: "Stale cloud response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-A", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-A", state: "final" },
    } as any);

    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "assistant", data: { text: "Latest cloud response" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-B", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    await Promise.resolve();
    await Promise.resolve();

    const forwardCalls = mockGraphqlFetch.mock.calls.filter(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("ecommerceSendMessage"),
    );
    expect(forwardCalls).toHaveLength(1);
    expect(forwardCalls[0][1].content).toContain("Latest cloud response");
    expect(mockEmitCsTelemetry).toHaveBeenCalledWith(
      "cs.message",
      expect.objectContaining({
        direction: "inbound",
        messageId: "msg-B",
        contentLength: "Latest buyer message".length,
        runId: "run-B",
        source: "backend_subscription",
      }),
    );
  });

  it("cloud catch-up snapshots: coalesces buyer messages during the quiet window", async () => {
    vi.useFakeTimers();
    process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS = "10000";
    try {
      const bridge = createBridge();
      bridge.setShopContext(defaultShop);
      mockRpcRequest.mockImplementation((method: string, params?: any) => {
        if (method === "agent") return Promise.resolve({ runId: params.idempotencyKey });
        if (method === "cs_register_session") return Promise.resolve(true);
        if (method === "sessions.patch") return Promise.resolve(true);
        return Promise.resolve({ ok: true });
      });

      const session = await bridge.getOrCreateSession(defaultShop.objectId, {
        conversationId: "conv-cloud-quiet",
        buyerUserId: "buyer-001",
      });

      const promiseA = session.dispatchCatchUp({
        dispatchReason: "PENDING_BUYER_MESSAGE",
        currentMessageId: "msg-quiet-a",
        currentMessageCursor: { messageId: "msg-quiet-a", messageIndex: "1", createTime: 100 },
        latestMessagePreview: "First buyer message",
        useMessageDelta: false,
      });

      await vi.advanceTimersByTimeAsync(9_000);
      expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent")).toHaveLength(0);

      const promiseB = session.dispatchCatchUp({
        dispatchReason: "PENDING_BUYER_MESSAGE",
        currentMessageId: "msg-quiet-b",
        currentMessageCursor: { messageId: "msg-quiet-b", messageIndex: "2", createTime: 101 },
        latestMessagePreview: "Latest buyer message",
        source: "backend_subscription",
        useMessageDelta: false,
      });

      await expect(promiseA).resolves.toEqual({ runId: undefined });
      await vi.advanceTimersByTimeAsync(9_999);
      expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent")).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promiseB).resolves.toEqual({ runId: "cs-start:conv-cloud-quiet:msg-quiet-b" });

      const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
      expect(agentCalls).toHaveLength(1);
      expect(agentCalls[0][1]).toEqual(
        expect.objectContaining({
          idempotencyKey: "cs-start:conv-cloud-quiet:msg-quiet-b",
        }),
      );
      expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "chat.abort")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
      process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS = "0";
    }
  });

  it("cloud catch-up snapshots: Airflow retry-pending duplicate batch keeps active runs for the same buyer message", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockImplementation((method: string, params?: any) => {
      if (method === "agent") return Promise.resolve({ runId: params.idempotencyKey });
      if (method === "chat.abort") return Promise.resolve({ aborted: true });
      if (method === "cs_register_session") return Promise.resolve(true);
      if (method === "sessions.patch") return Promise.resolve(true);
      return Promise.resolve({ ok: true });
    });

    const sessionA = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-airflow-a",
      buyerUserId: "buyer-001",
    });
    const sessionB = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-airflow-b",
      buyerUserId: "buyer-002",
    });

    await sessionA.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-airflow-a",
      currentMessageCursor: { messageId: "msg-airflow-a", messageIndex: "1", createTime: 100 },
      source: "AIRFLOW",
      dispatchEventTime: "2026-06-01T01:00:00.000Z",
      useMessageDelta: false,
    });
    await sessionB.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-airflow-b",
      currentMessageCursor: { messageId: "msg-airflow-b", messageIndex: "1", createTime: 100 },
      source: "AIRFLOW",
      dispatchEventTime: "2026-06-01T01:00:00.000Z",
      useMessageDelta: false,
    });

    await sessionA.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-airflow-a",
      currentMessageCursor: { messageId: "msg-airflow-a", messageIndex: "1", createTime: 100 },
      source: "AIRFLOW",
      dispatchEventTime: "2026-06-01T02:00:00.000Z",
      useMessageDelta: false,
    });
    await sessionB.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-airflow-b",
      currentMessageCursor: { messageId: "msg-airflow-b", messageIndex: "1", createTime: 100 },
      source: "AIRFLOW",
      dispatchEventTime: "2026-06-01T02:00:00.000Z",
      useMessageDelta: false,
    });

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    expect(agentCalls).toHaveLength(2);
    expect(agentCalls.map((c: any[]) => c[1].idempotencyKey)).toEqual([
      "cs-retry:conv-airflow-a:msg-airflow-a:1780275600000",
      "cs-retry:conv-airflow-b:msg-airflow-b:1780275600000",
    ]);
    const abortCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "chat.abort");
    expect(abortCalls).toHaveLength(0);
  });

  it("cloud catch-up snapshots: coalesces multiple Airflow pending buyer signals for one conversation", async () => {
    vi.useFakeTimers();
    const previousWindow = process.env.RIVONCLAW_CS_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS;
    process.env.RIVONCLAW_CS_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS = "0";
    try {
      const bridge = createBridge();
      rootStore.ingestGraphQLResponse({
        shops: [
          {
            id: defaultShop.objectId,
            platform: defaultShop.platform ?? "TIKTOK_SHOP",
            platformShopId: defaultShop.platformShopId,
            shopName: defaultShop.shopName,
            services: {
              customerService: {
                enabled: true,
                csDeviceId: "test-gateway",
                businessPrompt: defaultShop.systemPrompt,
                platformSystemPrompt: defaultShop.systemPrompt,
                runProfileId: defaultShop.runProfileId ?? null,
                csProviderOverride: null,
                csModelOverride: null,
              },
              affiliateService: {
                enabled: false,
                csDeviceId: null,
                runProfileId: null,
              },
            },
          },
        ],
      });
      bridge.syncFromCache();
      mockRpcRequest.mockImplementation((method: string, params?: any) => {
        if (method === "agent") return Promise.resolve({ runId: params.idempotencyKey });
        if (method === "chat.abort") return Promise.resolve({ aborted: true });
        if (method === "cs_register_session") return Promise.resolve(true);
        if (method === "sessions.patch") return Promise.resolve(true);
        return Promise.resolve({ ok: true });
      });

      const baseSignal = {
        type: "UNREAD_DETECTED" as const,
        source: "AIRFLOW" as const,
        shopId: defaultShop.objectId,
        platformShopId: defaultShop.platformShopId,
        conversationId: "conv-airflow-backlog",
        dispatchReason: "PENDING_BUYER_MESSAGE" as const,
        useMessageDelta: false,
        buyerUserId: "buyer-001",
        senderRole: "BUYER",
        aiEnabled: true,
      };

      await bridge.handleCsConversationSignal({
        ...baseSignal,
        messageId: "msg-airflow-1",
        messageIndex: "1001",
        eventTime: "2026-06-01T01:00:00.000Z",
        dispatchEventTime: "2026-06-01T01:00:00.000Z",
      });
      await bridge.handleCsConversationSignal({
        ...baseSignal,
        messageId: "msg-airflow-latest",
        messageIndex: "1002",
        eventTime: "2026-06-01T01:00:20.000Z",
        dispatchEventTime: "2026-06-01T01:00:20.000Z",
      });
      await bridge.handleCsConversationSignal({
        ...baseSignal,
        messageId: "msg-airflow-old-replayed-late",
        messageIndex: "1000",
        eventTime: "2026-06-01T00:59:50.000Z",
        dispatchEventTime: "2026-06-01T00:59:50.000Z",
      });

      expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent")).toHaveLength(0);
      await vi.runOnlyPendingTimersAsync();

      await vi.waitFor(() => {
        expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent")).toHaveLength(1);
      });
      const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
      expect(agentCalls).toHaveLength(1);
      expect(agentCalls[0][1]).toEqual(
        expect.objectContaining({
          idempotencyKey: "cs-retry:conv-airflow-backlog:msg-airflow-latest:1780275620000",
        }),
      );
      expect(mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "chat.abort")).toHaveLength(0);
    } finally {
      if (previousWindow === undefined) {
        delete process.env.RIVONCLAW_CS_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS;
      } else {
        process.env.RIVONCLAW_CS_AIRFLOW_PENDING_CATCH_UP_WINDOW_MS = previousWindow;
      }
      vi.useRealTimers();
    }
  });

  it("cloud catch-up snapshots: Airflow retry after no forwarded text uses a fresh run key", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockImplementation((method: string, params?: any) => {
      if (method === "agent") return Promise.resolve({ runId: params.idempotencyKey });
      if (method === "chat.abort") return Promise.resolve({ aborted: true });
      if (method === "cs_register_session") return Promise.resolve(true);
      if (method === "sessions.patch") return Promise.resolve(true);
      return Promise.resolve({ ok: true });
    });

    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-airflow-retry",
      buyerUserId: "buyer-001",
    });
    const options = {
      dispatchReason: "PENDING_BUYER_MESSAGE" as const,
      currentMessageId: "msg-airflow-retry",
      currentMessageCursor: { messageId: "msg-airflow-retry", messageIndex: "1", createTime: 100 },
      source: "AIRFLOW",
      dispatchEventTime: "2026-06-01T01:00:00.000Z",
      useMessageDelta: false,
    };

    await session.dispatchCatchUp(options);
    const firstRunId = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent")?.[1]
      .idempotencyKey;
    expect(firstRunId).toBe("cs-retry:conv-airflow-retry:msg-airflow-retry:1780275600000");

    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: firstRunId, state: "final" },
    } as any);

    await session.dispatchCatchUp({
      ...options,
      dispatchEventTime: "2026-06-01T02:00:00.000Z",
    });

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    expect(agentCalls).toHaveLength(2);
    expect(agentCalls[1][1].idempotencyKey).toBe(
      "cs-retry:conv-airflow-retry:msg-airflow-retry:1780279200000",
    );
    expect(agentCalls[1][1].idempotencyKey).not.toBe(agentCalls[0][1].idempotencyKey);
    expect(mockEmitCsError).toHaveBeenCalledWith(
      "run_error",
      expect.objectContaining({
        reason: "final_no_text",
        runId: firstRunId,
      }),
    );
  });

  it("cloud catch-up snapshots: newer buyer message wins while the older delta fetch is pending", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    let releaseFirstDelta: (() => void) | undefined;
    mockGraphqlFetch.mockImplementation(async (query: string, variables?: Record<string, any>) => {
      if (query.includes("csGetOrCreateSession")) {
        return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
      }
      if (query.includes("ecommerceGetConversationMessageDelta")) {
        if (variables?.currentMessageId === "msg-A") {
          await new Promise<void>((resolve) => {
            releaseFirstDelta = resolve;
          });
        }
        return {
          ecommerceGetConversationMessageDelta: {
            items: [
              {
                messageId: variables?.currentMessageId,
                index: variables?.currentMessageId === "msg-A" ? "1" : "2",
                type: "TEXT",
                text:
                  variables?.currentMessageId === "msg-A" ? "First duplicate" : "Second duplicate",
                createTime: variables?.currentMessageId === "msg-A" ? 100 : 101,
                sender: { role: "BUYER", nickname: "Alice" },
              },
            ],
            meta: {
              completeness: "COMPLETE",
              anchorMatchType: "PLATFORM_MESSAGE_ID",
              currentMessageFound: true,
              anchorMatched: true,
              pageLimitReached: false,
              fetchedMessageCount: 1,
              anchorMessageId: "msg-seen",
              anchorCreateTime: 99,
            },
          },
        };
      }
      return { ecommerceSendMessage: { messageId: "msg-default" } };
    });

    const session = await bridge.getOrCreateSession(defaultShop.objectId, {
      conversationId: "conv-cloud-delta-rapid",
      buyerUserId: "buyer-001",
    });

    const promiseA = session.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-A",
      currentMessageCursor: { messageId: "msg-A", messageIndex: "1", createTime: 100 },
    });
    await new Promise((r) => setTimeout(r, 10));

    const promiseB = session.dispatchCatchUp({
      dispatchReason: "PENDING_BUYER_MESSAGE",
      currentMessageId: "msg-B",
      currentMessageCursor: { messageId: "msg-B", messageIndex: "2", createTime: 101 },
    });
    await new Promise((r) => setTimeout(r, 10));
    releaseFirstDelta?.();

    await Promise.all([promiseA, promiseB]);

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0][1].idempotencyKey).toBe("cs-start:conv-cloud-delta-rapid:msg-B");
    expect(agentCalls[0][1].message).toContain("Second duplicate");
    expect(agentCalls[0][1].message).not.toContain("First duplicate");
  });

  it("undelivered notice: second message includes notice about 1 undelivered reply", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-1" });

    // First message dispatches normally
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-1", content: JSON.stringify({ content: "First" }) }),
    );

    // Second message aborts first and dispatches with notice
    mockRpcRequest.mockResolvedValue({ runId: "run-2" });
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-2", content: JSON.stringify({ content: "Second" }) }),
    );

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    const lastAgentCall = agentCalls[agentCalls.length - 1];
    const message = lastAgentCall[1].message as string;

    expect(message).toContain("[Internal: System]");
    expect(message).toContain("Your previous reply was not delivered");
    expect(message).toContain("[Customer Service Conversation Work Package]");
    expect(message).toContain("Second");
  });

  it("undelivered notice: third message includes count of 2 undelivered replies", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-1" });

    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-1", content: JSON.stringify({ content: "First" }) }),
    );

    mockRpcRequest.mockResolvedValue({ runId: "run-2" });
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-2", content: JSON.stringify({ content: "Second" }) }),
    );

    mockRpcRequest.mockResolvedValue({ runId: "run-3" });
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-3", content: JSON.stringify({ content: "Third" }) }),
    );

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    const lastAgentCall = agentCalls[agentCalls.length - 1];
    const message = lastAgentCall[1].message as string;

    expect(message).toContain("last 2 replies were not delivered");
    expect(message).toContain("Third");
  });

  it("undelivered count resets after successful delivery", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-1" });

    // First message
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-1", content: JSON.stringify({ content: "First" }) }),
    );

    // Second message aborts first (undeliveredCount = 1)
    mockRpcRequest.mockResolvedValue({ runId: "run-2" });
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-2", content: JSON.stringify({ content: "Second" }) }),
    );

    // Simulate successful delivery for run-2 via agent events (per-turn forwarding)
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-2", stream: "assistant", data: { text: "Reply" } },
    } as any);
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId: "run-2", stream: "lifecycle", data: { phase: "end" } },
    } as any);
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId: "run-2", state: "final" },
    } as any);

    // Wait for async forwardTextToBuyer to complete
    await new Promise((r) => setTimeout(r, 10));

    // Third message — should NOT have undelivered notice (count was reset)
    mockRpcRequest.mockResolvedValue({ runId: "run-3" });
    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-3", content: JSON.stringify({ content: "Third" }) }),
    );

    const agentCalls = mockRpcRequest.mock.calls.filter((c: any[]) => c[0] === "agent");
    const lastAgentCall = agentCalls[agentCalls.length - 1];
    const message = lastAgentCall[1].message as string;

    expect(message).not.toContain("[Internal: System]");
    expect(message).not.toContain("not delivered");
    expect(message).toContain("[Customer Service Conversation Work Package]");
    expect(message).toContain("Third");
  });

  it("no undelivered notice on first message", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    mockRpcRequest.mockResolvedValue({ runId: "run-1" });

    await triggerMessage(
      bridge,
      createFrame({ messageId: "msg-1", content: JSON.stringify({ content: "Hello" }) }),
    );

    const agentCall = mockRpcRequest.mock.calls.find((c: any[]) => c[0] === "agent");
    const message = agentCall![1].message as string;

    expect(message).not.toContain("[Internal: System]");
    expect(message).not.toContain("not delivered");
    expect(message).toContain("[Customer Service Conversation Work Package]");
    expect(message).toContain("text: Hello");
  });
});

// ─── 14. Per-turn message forwarding (agent events) ─────────────────────────

describe("per-turn message forwarding", () => {
  /**
   * Helper: dispatch a buyer message and return the runId.
   * Sets up the bridge with a shop context and dispatches the message.
   */
  async function dispatchAndGetRunId(
    bridge: ReturnType<typeof createBridge>,
    runId: string,
    overrides?: Partial<TestCSMessagePayload>,
  ): Promise<void> {
    mockRpcRequest.mockResolvedValue({ runId });
    await triggerMessage(bridge, createFrame(overrides));
  }

  /** Helper: send an agent event. */
  function agentEvent(
    bridge: ReturnType<typeof createBridge>,
    runId: string,
    stream: string,
    data: Record<string, unknown>,
  ): void {
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId, stream, data },
    } as any);
  }

  /** Helper: send a chat final event for cleanup. */
  function chatFinal(bridge: ReturnType<typeof createBridge>, runId: string): void {
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId, state: "final" },
    } as any);
  }

  /**
   * Helper: count ecommerceSendMessage calls and return their content args.
   *
   * `async` so callers can await the microtask queue before asserting —
   * `forwardTextToBuyer` awaits `collectUsageSnapshot` (a `sessions.describe`
   * RPC) before firing graphqlFetch, so the mutation mock is recorded one
   * microtask cycle later than the agent event that triggered it. Without
   * this flush, synchronous assertions right after an `agentEvent(...)` call
   * would read an empty mock.calls array.
   */
  async function getForwardedTexts(): Promise<string[]> {
    // Two rounds of microtask flushing cover the nested awaits inside
    // forwardTextToBuyer → collectUsageSnapshot → sessions.describe → graphqlFetch.
    await Promise.resolve();
    await Promise.resolve();
    return mockGraphqlFetch.mock.calls
      .filter((c: any[]) => typeof c[0] === "string" && c[0].includes("ecommerceSendMessage"))
      .map((c: any[]) => {
        const parsed = JSON.parse(c[1].content as string);
        return parsed.content as string;
      });
  }

  it("single segment (no tool calls): text forwarded once on lifecycle end", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    agentEvent(bridge, "run-1", "assistant", { text: "Hello buyer!" });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Hello buyer!");
  });

  it("emoji-only assistant text is forwarded as valid buyer-facing text", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-emoji");

    agentEvent(bridge, "run-emoji", "assistant", { text: "😊" });
    agentEvent(bridge, "run-emoji", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("😊");
    expect(mockEmitCsError).not.toHaveBeenCalledWith(
      "sanitize",
      expect.objectContaining({
        reason: "internal_protocol",
        runId: "run-emoji",
      }),
    );
  });

  it("multiple segments (with tool calls): each segment forwarded separately", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // First turn: assistant text, then tool start
    agentEvent(bridge, "run-1", "assistant", { text: "Let me check." });
    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "search" });

    // Second turn: text resets per-turn (not accumulated across whole run)
    agentEvent(bridge, "run-1", "assistant", { text: "Here is the answer." });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(2);
    expect(texts[0]).toBe("Let me check.");
    expect(texts[1]).toBe("Here is the answer.");
  });

  it("terminal CS tool without text is not reported as a no-text run error", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "ecom_cs_end_session" });
    chatFinal(bridge, "run-1");

    expect(mockEmitCsError).not.toHaveBeenCalledWith(
      "run_error",
      expect.objectContaining({
        reason: "final_no_text",
        runId: "run-1",
      }),
    );
  });

  it("three segments: text between two tool calls, plus final segment", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // Segment 1
    agentEvent(bridge, "run-1", "assistant", { text: "Segment one." });
    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "tool_a" });

    // Segment 2 (text resets per-turn)
    agentEvent(bridge, "run-1", "assistant", { text: "Segment two." });
    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "tool_b" });

    // Segment 3 (text resets per-turn)
    agentEvent(bridge, "run-1", "assistant", { text: "Segment three." });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(3);
    expect(texts[0]).toBe("Segment one.");
    expect(texts[1]).toBe("Segment two.");
    expect(texts[2]).toBe("Segment three.");
  });

  it("aborted run: text NOT forwarded", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // Second message arrives, aborting run-1
    mockRpcRequest.mockResolvedValue({ runId: "run-2" });
    await triggerMessage(bridge, createFrame({ messageId: "msg-2" }));

    // Agent events for run-1 arrive after abort
    agentEvent(bridge, "run-1", "assistant", { text: "Stale text" });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    // Cleanup
    chatFinal(bridge, "run-1");

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("empty text: tool call without any text does not forward", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // Tool starts without any prior assistant text
    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "search" });

    // Assistant text comes after tool, then lifecycle end
    agentEvent(bridge, "run-1", "assistant", { text: "Result found." });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Result found.");
  });

  it("error lifecycle: buffered text IS flushed to buyer (partial response delivery)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    agentEvent(bridge, "run-1", "assistant", { text: "Partial output" });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "error" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Partial output");
  });

  it("non-CS run: agent events ignored (not in pendingRuns)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    // Don't dispatch any CS message — "run-other" is not in pendingRuns

    agentEvent(bridge, "run-other", "assistant", { text: "Non-CS text" });
    agentEvent(bridge, "run-other", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("whitespace-only new segment is not forwarded", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    agentEvent(bridge, "run-1", "assistant", { text: "First part." });
    agentEvent(bridge, "run-1", "tool", { phase: "start", toolName: "tool_a" });

    // Second turn is whitespace-only (per-turn text resets)
    agentEvent(bridge, "run-1", "assistant", { text: "   " });
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    // Only the first segment should be forwarded; the whitespace-only segment is skipped
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("First part.");
  });

  it("chat final event cleans up turn buffers as safety net", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // Agent text arrives but lifecycle never fires (unusual)
    agentEvent(bridge, "run-1", "assistant", { text: "Buffered text" });

    // Chat final fires — should clean up buffers without forwarding
    chatFinal(bridge, "run-1");

    // No text forwarded (lifecycle end never fired)
    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("disposes the completed CS round after successful outbound delivery + chat final", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-gc-success");

    const session = (bridge as any).sessions.get("conv-789");
    expect(session.getDebugRoundCount()).toBe(1);

    agentEvent(bridge, "run-gc-success", "assistant", { text: "Delivered text" });
    agentEvent(bridge, "run-gc-success", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 20));

    expect(session.getDebugRoundCount()).toBe(1);

    chatFinal(bridge, "run-gc-success");
    expect(session.getDebugRoundCount()).toBe(0);
  });

  it("tool phase other than 'start' does not flush", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    agentEvent(bridge, "run-1", "assistant", { text: "Pending text" });
    // tool phase "end" should NOT trigger a flush
    agentEvent(bridge, "run-1", "tool", { phase: "end", toolName: "search" });

    // Nothing forwarded yet — text still buffered
    expect(await getForwardedTexts()).toHaveLength(0);

    // Now lifecycle end flushes
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Pending text");
  });

  it("data.text that is not a string is ignored", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-1");

    // data.text is a number — should be ignored
    agentEvent(bridge, "run-1", "assistant", { text: 42 } as any);
    agentEvent(bridge, "run-1", "lifecycle", { phase: "end" });

    expect(await getForwardedTexts()).toHaveLength(0);
  });

  it("strips leaked tool/protocol scaffolding before forwarding buyer-facing text", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-protocol-clean");

    agentEvent(bridge, "run-protocol-clean", "assistant", {
      text: `{"tool_uses":[{"recipient_name":"functions.ecom_cs_get_product","parameters":{"product_id":"1732306320036107219"}}]}
{"product_id":"1732306320036107219"}
{"tool":"functions.ecom_cs_get_product","product_id":"1732306320036107219"}{"name":"functions.ecom_cs_get_product","arguments":{"product_id":"1732306320036107219"}}
But the tool name is shown in the line above: \`to=functions.ecom_cs_get_product\`. That is added by system because I included it.
In this task, I should use:
\`\`\`json
{"product_id":"1732306320036107219"}
\`\`\`
and specify the tool with "to=functions.ecom_cs_get_product" but that's outside content. In the assistant interface, I can do:
Gracias por enviar el producto.

Ahora mismo no me está cargando la ficha de ese producto (para confirmar stock/variantes/precio). ¿Me puedes enviar una captura de pantalla donde se vean las variantes (mm y largo) o escribirme el nombre de la variante que quieres?

Con eso te confirmo de inmediato si está disponible y cuál opción te conviene más.`,
    });
    agentEvent(bridge, "run-protocol-clean", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe(
      `Gracias por enviar el producto.

Ahora mismo no me está cargando la ficha de ese producto (para confirmar stock/variantes/precio). ¿Me puedes enviar una captura de pantalla donde se vean las variantes (mm y largo) o escribirme el nombre de la variante que quieres?

Con eso te confirmo de inmediato si está disponible y cuál opción te conviene más.`,
    );
  });

  it("drops text segments that are only leaked tool/protocol scaffolding", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-protocol-drop");

    agentEvent(bridge, "run-protocol-drop", "assistant", {
      text: `{"tool_uses":[{"recipient_name":"functions.ecom_cs_get_product","parameters":{"product_id":"1732306320036107219"}}]}
{"product_id":"1732306320036107219"}
But the tool name is shown in the line above: \`to=functions.ecom_cs_get_product\`.
\`\`\`json
{"product_id":"1732306320036107219"}
\`\`\``,
    });
    agentEvent(bridge, "run-protocol-drop", "lifecycle", { phase: "end" });

    expect(await getForwardedTexts()).toHaveLength(0);
  });
});

// ─── 15. Terminal guarantee: error/timeout handling ──────────────────────────

describe("terminal guarantee (error/timeout)", () => {
  /**
   * Helper: dispatch a buyer message and return the runId.
   */
  async function dispatchAndGetRunId(
    bridge: ReturnType<typeof createBridge>,
    runId: string,
    overrides?: Partial<TestCSMessagePayload>,
  ): Promise<void> {
    mockRpcRequest.mockResolvedValue({ runId });
    await triggerMessage(bridge, createFrame(overrides));
  }

  /** Helper: send an agent event. */
  function agentEvent(
    bridge: ReturnType<typeof createBridge>,
    runId: string,
    stream: string,
    data: Record<string, unknown>,
  ): void {
    bridge.onGatewayEvent({
      event: "agent",
      payload: { runId, stream, data },
    } as any);
  }

  /** Helper: send a chat error event. */
  function chatError(bridge: ReturnType<typeof createBridge>, runId: string): void {
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId, state: "error" },
    } as any);
  }

  /** Helper: send a chat final event for cleanup. */
  function chatFinal(bridge: ReturnType<typeof createBridge>, runId: string): void {
    bridge.onGatewayEvent({
      event: "chat",
      payload: { runId, state: "final" },
    } as any);
  }

  /**
   * Helper: count ecommerceSendMessage calls and return their content args.
   * Async to flush the collectUsageSnapshot → sessions.describe microtask chain
   * before assertions — see the describe-14 helper's doc for full context.
   */
  async function getForwardedTexts(): Promise<string[]> {
    await Promise.resolve();
    await Promise.resolve();
    return mockGraphqlFetch.mock.calls
      .filter((c: any[]) => typeof c[0] === "string" && c[0].includes("ecommerceSendMessage"))
      .map((c: any[]) => {
        const parsed = JSON.parse(c[1].content as string);
        return parsed.content as string;
      });
  }

  function getAgentDispatchMessages(): string[] {
    return mockRpcRequest.mock.calls
      .filter((c: any[]) => c[0] === "agent")
      .map((c: any[]) => c[1]?.message as string);
  }

  async function waitForCondition(predicate: () => boolean, timeoutMs = 300): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("Timed out waiting for condition");
  }

  it("lifecycle error with buffered text: text is flushed to buyer", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-err-1");

    agentEvent(bridge, "run-err-1", "assistant", { text: "Here is your answer so far" });
    agentEvent(bridge, "run-err-1", "lifecycle", { phase: "error" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Here is your answer so far");
  });

  it("chat error with no forwarded text: no fallback sent (fail fast)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-err-2");

    // No agent text events — run errored before producing output
    chatError(bridge, "run-err-2");

    // Wait for any async side effects
    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("chat error with previously forwarded text: no fallback sent", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-err-3");

    // Agent produces text in first turn, then a tool call
    agentEvent(bridge, "run-err-3", "assistant", { text: "Let me look that up." });
    agentEvent(bridge, "run-err-3", "tool", { phase: "start", toolName: "search" });

    // Wait for async forwardTextToBuyer to complete (populates forwardedRuns)
    await new Promise((r) => setTimeout(r, 10));

    // Run errors after the tool call (no lifecycle end)
    chatError(bridge, "run-err-3");

    // Wait for potential fallback
    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    // Only the first turn's text should be forwarded; no fallback
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Let me look that up.");
  });

  it("aborted run error: no fallback sent", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-abort-1");

    // Second message arrives, aborting run-abort-1
    mockRpcRequest.mockResolvedValue({ runId: "run-abort-2" });
    await triggerMessage(bridge, createFrame({ messageId: "msg-abort-2" }));

    // Chat error for the aborted run
    chatError(bridge, "run-abort-1");

    // Wait for potential fallback
    await new Promise((r) => setTimeout(r, 10));

    // No text should be forwarded for the aborted run
    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("timeout message sanitization: raw timeout text dropped silently (no forward)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-timeout-1");

    agentEvent(bridge, "run-timeout-1", "assistant", {
      text: "Request timed out before a response was generated. You may want to increase `agents.defaults.timeoutSeconds` in your configuration.",
    });
    agentEvent(bridge, "run-timeout-1", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    // Entire text was a runtime error → dropped, no forward. Cron sweep
    // will re-surface the turn.
    expect(texts).toHaveLength(0);
  });

  it("timeout message sanitization: LLM idle timeout dropped silently", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-timeout-2");

    agentEvent(bridge, "run-timeout-2", "assistant", {
      text: "LLM idle timeout — no response received within the configured period.",
    });
    agentEvent(bridge, "run-timeout-2", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(0);
  });

  it("timeout suffix stripped from real content", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-timeout-3");

    agentEvent(bridge, "run-timeout-3", "assistant", {
      text: "Here is your order status: shipped on April 10.\nRequest timed out before a response was generated.",
    });
    agentEvent(bridge, "run-timeout-3", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Here is your order status: shipped on April 10.");
  });

  it("normal text passes through sanitization unchanged", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-normal");

    agentEvent(bridge, "run-normal", "assistant", { text: "Your refund has been processed!" });
    agentEvent(bridge, "run-normal", "lifecycle", { phase: "end" });

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Your refund has been processed!");
  });

  it("lifecycle error flushes text then chat error does NOT send fallback (text was forwarded)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-err-flush");

    // Agent produces text, then lifecycle error flushes it
    agentEvent(bridge, "run-err-flush", "assistant", { text: "Partial response before error" });
    agentEvent(bridge, "run-err-flush", "lifecycle", { phase: "error" });

    // Wait for async forwardTextToBuyer to complete
    await new Promise((r) => setTimeout(r, 10));

    // Chat error arrives — should NOT send fallback because text was already forwarded
    chatError(bridge, "run-err-flush");

    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    // Only the flushed text, no fallback
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Partial response before error");
  });

  // ─── Delivery failure scenarios ──────────────────────────────────────────

  /**
   * Make mockGraphqlFetch reject the first N ecommerceSendMessage calls,
   * then succeed for subsequent ones.  Non-send queries keep working.
   */
  function failFirstNSends(n: number): void {
    let sendCount = 0;
    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          sendCount++;
          if (sendCount <= n) throw new Error("simulated delivery failure");
          return { ecommerceSendMessage: { messageId: "ok" } };
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        return {};
      },
    );
  }

  it("forward rejects → silent drop (cron sweep handles recovery, no boilerplate to buyer)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-fwd-fail-1");

    // First send rejects; anything subsequent would also succeed, but we
    // expect no second attempt.
    failFirstNSends(1);

    agentEvent(bridge, "run-fwd-fail-1", "assistant", { text: "Some answer" });
    agentEvent(bridge, "run-fwd-fail-1", "lifecycle", { phase: "end" });

    // Wait for forward rejection to settle
    await new Promise((r) => setTimeout(r, 50));

    // Chat error arrives — still no duplicate
    chatError(bridge, "run-fwd-fail-1");
    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    // Only the original (failed) attempt is visible to the forwarder; no
    // follow-up "sorry I couldn't" apology is sent.
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Some answer");
  });

  it("forward rejects with TikTok sensitive-content error → emits deliver telemetry with reason sensitive_content", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-fwd-sensitive");

    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          throw new Error("TikTok API error 45101006: hit sensitive");
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        return {};
      },
    );

    agentEvent(bridge, "run-fwd-sensitive", "assistant", { text: "Refund details" });
    agentEvent(bridge, "run-fwd-sensitive", "lifecycle", { phase: "end" });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockEmitCsError).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        reason: "sensitive_content",
        runId: "run-fwd-sensitive",
        textLength: "Refund details".length,
      }),
    );
  });

  it("sensitive-content rejection triggers one local rewrite recovery run", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    let nextAgentRun = 0;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") {
        nextAgentRun++;
        return { runId: nextAgentRun === 1 ? "run-fwd-sensitive" : "run-fwd-sensitive-rewrite" };
      }
      return { ok: true };
    });

    let sendCount = 0;
    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          sendCount++;
          if (sendCount === 1) throw new Error("TikTok API error 45101006: hit sensitive");
          return { ecommerceSendMessage: { messageId: "ok" } };
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        return {};
      },
    );

    await triggerMessage(bridge, createFrame());
    const session = (bridge as any).sessions.get("conv-789");
    expect(session.getDebugRoundCount()).toBe(1);

    agentEvent(bridge, "run-fwd-sensitive", "assistant", {
      text: "Contact PayPal dispute and block the card.",
    });
    agentEvent(bridge, "run-fwd-sensitive", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 50));
    chatFinal(bridge, "run-fwd-sensitive");
    expect(session.getDebugRoundCount()).toBe(1);

    const dispatchMessages = getAgentDispatchMessages();
    expect(dispatchMessages).toHaveLength(2);
    expect(dispatchMessages[1]).toContain("off-platform payment method or communication apps");
    expect(dispatchMessages[1]).toContain("Rephrase the same meaning");
    expect(dispatchMessages[1]).toContain("Contact PayPal dispute and block the card.");

    agentEvent(bridge, "run-fwd-sensitive-rewrite", "assistant", {
      text: "Please contact PayPal directly for help with the pending payment.",
    });
    agentEvent(bridge, "run-fwd-sensitive-rewrite", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 50));
    expect(session.getDebugRoundCount()).toBe(1);
    chatFinal(bridge, "run-fwd-sensitive-rewrite");
    expect(session.getDebugRoundCount()).toBe(0);

    const texts = await getForwardedTexts();
    expect(texts).toEqual([
      "Contact PayPal dispute and block the card.",
      "Please contact PayPal directly for help with the pending payment.",
    ]);
  });

  it("sensitive-content recovery is capped to one local rewrite attempt", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    let nextAgentRun = 0;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") {
        nextAgentRun++;
        return { runId: nextAgentRun === 1 ? "run-fwd-sensitive" : "run-fwd-sensitive-rewrite" };
      }
      return { ok: true };
    });

    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          throw new Error("TikTok API error 45101006: hit sensitive");
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        return {};
      },
    );

    await triggerMessage(bridge, createFrame());

    agentEvent(bridge, "run-fwd-sensitive", "assistant", { text: "Original blocked reply" });
    agentEvent(bridge, "run-fwd-sensitive", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 50));

    agentEvent(bridge, "run-fwd-sensitive-rewrite", "assistant", { text: "Still blocked rewrite" });
    agentEvent(bridge, "run-fwd-sensitive-rewrite", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 50));

    expect(getAgentDispatchMessages()).toHaveLength(2);
  });

  it("aborts an in-flight sensitive-content recovery dispatch when a newer buyer message arrives", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);

    let resolveRecoveryDispatch: ((value: { runId: string }) => void) | undefined;
    const recoveryDispatch = new Promise<{ runId: string }>((resolve) => {
      resolveRecoveryDispatch = resolve;
    });

    let agentDispatchCount = 0;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") {
        agentDispatchCount++;
        if (agentDispatchCount === 1) return { runId: "run-sensitive-original" };
        if (agentDispatchCount === 2) return recoveryDispatch;
        return { runId: "run-newer-buyer-message" };
      }
      return { ok: true };
    });

    let sendCount = 0;
    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          sendCount++;
          if (sendCount === 1) throw new Error("TikTok API error 45101006: hit sensitive");
          return { ecommerceSendMessage: { messageId: `ok-${sendCount}` } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        return {};
      },
    );

    await triggerMessage(bridge, createFrame({ messageId: "msg-sensitive" }));
    const session = (bridge as any).sessions.get("conv-789");

    agentEvent(bridge, "run-sensitive-original", "assistant", { text: "Original blocked reply" });
    agentEvent(bridge, "run-sensitive-original", "lifecycle", { phase: "end" });
    await waitForCondition(() => agentDispatchCount === 2);

    await triggerMessage(
      bridge,
      createFrame({
        messageId: "msg-newer",
        content: JSON.stringify({ content: "Actually, I have a new question" }),
      }),
    );
    expect(agentDispatchCount).toBe(3);

    resolveRecoveryDispatch?.({ runId: "run-sensitive-recovery" });
    await waitForCondition(() =>
      mockRpcRequest.mock.calls.some((c: any[]) =>
        c[1]?.message?.includes("Actually, I have a new question"),
      ),
    );
    await waitForCondition(() => (bridge as any).pendingRuns.has("run-sensitive-recovery"));

    agentEvent(bridge, "run-sensitive-recovery", "assistant", { text: "Stale recovery reply" });
    agentEvent(bridge, "run-sensitive-recovery", "lifecycle", { phase: "end" });
    chatFinal(bridge, "run-sensitive-recovery");
    await new Promise((r) => setTimeout(r, 30));
    expect(session.getDebugRoundCount()).toBe(1);

    agentEvent(bridge, "run-newer-buyer-message", "assistant", {
      text: "Fresh reply for the newer message",
    });
    agentEvent(bridge, "run-newer-buyer-message", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 30));

    const texts = await getForwardedTexts();
    expect(texts).toContain("Original blocked reply");
    expect(texts).toContain("Fresh reply for the newer message");
    expect(texts).not.toContain("Stale recovery reply");
  });

  it("disposes the terminal CS round after non-recoverable delivery failure + chat error", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-gc-fail");

    const session = (bridge as any).sessions.get("conv-789");
    expect(session.getDebugRoundCount()).toBe(1);

    failFirstNSends(1);

    agentEvent(bridge, "run-gc-fail", "assistant", { text: "Will fail delivery" });
    agentEvent(bridge, "run-gc-fail", "lifecycle", { phase: "end" });
    await new Promise((r) => setTimeout(r, 50));

    expect(session.getDebugRoundCount()).toBe(1);

    chatError(bridge, "run-gc-fail");
    await new Promise((r) => setTimeout(r, 10));

    expect(session.getDebugRoundCount()).toBe(0);
  });

  it("lifecycle error flush fails → silent drop, chat error does not send apology", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-fwd-fail-2");

    failFirstNSends(1);

    agentEvent(bridge, "run-fwd-fail-2", "assistant", { text: "Partial output" });
    agentEvent(bridge, "run-fwd-fail-2", "lifecycle", { phase: "error" });

    // Wait for forward rejection
    await new Promise((r) => setTimeout(r, 50));

    // Chat error arrives — no duplicate, no apology
    chatError(bridge, "run-fwd-fail-2");
    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Partial output");
  });

  it("forward succeeds → chat error does not send fallback (no duplicate)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-fwd-ok");

    agentEvent(bridge, "run-fwd-ok", "assistant", { text: "Successful response" });
    agentEvent(bridge, "run-fwd-ok", "lifecycle", { phase: "error" });

    // Wait for forward to succeed
    await new Promise((r) => setTimeout(r, 10));

    chatError(bridge, "run-fwd-ok");
    await new Promise((r) => setTimeout(r, 10));

    const texts = await getForwardedTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Successful response");
  });

  it("run aborted after send starts + forward rejects → no fallback (abort-after-send-start)", async () => {
    const bridge = createBridge();
    bridge.setShopContext(defaultShop);
    await dispatchAndGetRunId(bridge, "run-abort-race");

    // Make the first send hang, then reject after a delay
    let rejectSend!: (err: Error) => void;
    let sendCount = 0;
    mockGraphqlFetch.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("ecommerceSendMessage")) {
          sendCount++;
          if (sendCount === 1) {
            // First send: return a promise we control
            return new Promise((_resolve, reject) => {
              rejectSend = reject;
            });
          }
          return { ecommerceSendMessage: { messageId: "ok" } };
        }
        if (query.includes("ecommerceGetConversationDetails")) {
          return { ecommerceGetConversationDetails: { buyer: null } };
        }
        if (query.includes("csGetOrCreateSession")) {
          return { csGetOrCreateSession: { sessionId: "sess-001", isNew: true, balance: 100 } };
        }
        if (query.includes("ecommerceGetConversationMessageDelta")) {
          return buildTestConversationDeltaResult(variables?.currentMessageId);
        }
        return {};
      },
    );

    // Agent produces text, lifecycle ends → flushTurnText starts send (hangs)
    agentEvent(bridge, "run-abort-race", "assistant", { text: "Stale answer" });
    agentEvent(bridge, "run-abort-race", "lifecycle", { phase: "end" });

    // A new buyer message arrives, aborting run-abort-race
    mockRpcRequest.mockResolvedValue({ runId: "run-abort-race-2" });
    await triggerMessage(bridge, createFrame({ messageId: "msg-abort-race-2" }));

    // Now reject the original send
    rejectSend(new Error("network failure"));
    await new Promise((r) => setTimeout(r, 50));

    const texts = await getForwardedTexts();
    // Only the original failed attempt; NO fallback (run was aborted)
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe("Stale answer"); // attempted but failed, no fallback
  });
});

// ─── 17. CS BI events now flow through `emitCsTelemetry`, not GraphQL ────────
//
// The earlier `csIncrementMessageCount wiring` suite covered a GraphQL mutation
// that advanced `cs_sessions.messageCount` on every message. That write was
// deleted when CS analytics moved to the ClickHouse event stream — the new
// `cs.message` emits happen inside `CustomerServiceSession` via
// `emitCsTelemetry(...)` and are covered directly in
// `customer-service-session.forwardText.test.ts`. Bridge-level wiring tests for
// the old mutation are no longer applicable.
