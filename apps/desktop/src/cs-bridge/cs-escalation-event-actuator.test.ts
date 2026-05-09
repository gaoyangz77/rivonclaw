import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockRpcRequest = vi.fn();
vi.mock("../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockRpcRequest(...args),
    ensureRpcReady: () => ({ request: mockRpcRequest, isConnected: () => true }),
  },
}));

const mockBuyerDetailsFetch = vi.fn();
vi.mock("../auth/session-ref.js", () => ({
  getAuthSession: () => ({
    graphqlFetch: (...args: unknown[]) => mockBuyerDetailsFetch(...args),
  }),
}));

vi.mock("../gateway/provider-keys-ref.js", () => ({
  getProviderKeysStore: () => ({ getAll: () => [] }),
}));

vi.mock("../gateway/vendor-dir-ref.js", () => ({
  getVendorDir: () => "/fake/vendor",
}));

vi.mock("@rivonclaw/gateway", () => ({
  readFullModelCatalog: vi.fn().mockResolvedValue({}),
}));

vi.mock("../telemetry/cs-telemetry-ref.js", () => ({
  emitCsError: vi.fn(),
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

const { mockGetCsBridge } = vi.hoisted(() => ({
  mockGetCsBridge: vi.fn(),
}));
vi.mock("../gateway/connection.js", () => ({
  getCsBridge: () => mockGetCsBridge(),
}));

import { handleCsEscalationEvent } from "./cs-escalation-event-actuator.js";
import { CustomerServiceBridge } from "./customer-service-bridge.js";
import { rootStore } from "../app/store/desktop-store.js";
import type { CsEscalationEventDeliveryPayload } from "../cloud/backend-subscription-client.js";

const delivery: CsEscalationEventDeliveryPayload = {
  escalation: {
    id: "esc_cloud_send_001",
    shopId: "shop-mongo-001",
    conversationId: "conv-cloud-send-001",
    buyerUserId: "buyer-cloud-send-001",
    orderId: null,
    reason: "Needs manager approval",
    context: null,
    version: 1,
    status: "PENDING",
  },
  event: {
    id: "csevt_cloud_send_001",
    type: "ESCALATION_CREATED",
    status: "PENDING",
    decision: null,
    instructions: null,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  },
};

function seedShop(csDeviceId: string | null = "device-001"): void {
  rootStore.ingestGraphQLResponse({
    shops: [
      {
        __typename: "Shop",
        id: "shop-mongo-001",
        platform: "tiktok",
        platformAppId: "",
        platformShopId: "platform-shop-001",
        shopName: "Cloud Escalation Shop",
        authStatus: "active",
        region: "US",
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        services: {
          customerService: {
            enabled: true,
            businessPrompt: "",
            csDeviceId,
            csProviderOverride: null,
            csModelOverride: null,
            escalationChannelId: "telegram:acct_cloud_send",
            escalationRecipientId: "987654321",
            runProfileId: null,
          },
          customerServiceBilling: null,
        },
      },
    ],
  });
}

describe("handleCsEscalationEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcRequest.mockResolvedValue({ ok: true });
    mockBuyerDetailsFetch.mockResolvedValue({
      ecommerceGetConversationDetails: { buyer: { nickname: "Buyer Nick" } },
    });
    rootStore.ingestGraphQLResponse({
      shops: [],
      runProfiles: [],
      surfaces: [],
      toolSpecs: [],
    });
  });

  it("claims escalation-created events, sends the manager notification, then acks success", async () => {
    seedShop();
    const bridge = new CustomerServiceBridge({
      gatewayId: "test-gateway",
      defaultRunProfileId: "CUSTOMER_SERVICE",
    });
    bridge.setShopContext({
      objectId: "shop-mongo-001",
      platformShopId: "platform-shop-001",
      shopName: "Cloud Escalation Shop",
      systemPrompt: "You are a CS assistant.",
      runProfileId: "CUSTOMER_SERVICE",
    });
    mockGetCsBridge.mockReturnValue(bridge);

    const graphqlFetch = vi.fn(async (query: string, variables: unknown) => {
      if (query.includes("CsClaimEscalationEvent")) {
        expect(variables).toEqual({ input: { eventId: delivery.event.id } });
        return { csClaimEscalationEvent: delivery };
      }
      if (query.includes("CsAckEscalationEvent")) {
        expect(variables).toEqual({
          input: { eventId: delivery.event.id, success: true },
        });
        return { csAckEscalationEvent: delivery };
      }
      throw new Error(`Unexpected GraphQL query: ${query}`);
    });

    await handleCsEscalationEvent(
      { graphqlFetch } as any,
      "device-001",
      delivery,
    );

    expect(mockRpcRequest).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "987654321",
        channel: "telegram",
        accountId: "acct_cloud_send",
        idempotencyKey: "cs-escalate:esc_cloud_send_001",
        message: expect.stringContaining("Needs manager approval"),
      }),
    );
    expect(mockRpcRequest).not.toHaveBeenCalledWith("cs_register_session", expect.anything());
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
  });

  it("does not claim escalation events assigned to a different device", async () => {
    seedShop("other-device");
    const bridge = new CustomerServiceBridge({
      gatewayId: "test-gateway",
      defaultRunProfileId: "CUSTOMER_SERVICE",
    });
    mockGetCsBridge.mockReturnValue(bridge);

    const graphqlFetch = vi.fn();

    await handleCsEscalationEvent(
      { graphqlFetch } as any,
      "device-001",
      delivery,
    );

    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(mockRpcRequest).not.toHaveBeenCalled();
  });
});
