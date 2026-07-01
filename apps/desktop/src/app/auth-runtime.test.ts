import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAuthSession: vi.fn(),
  authSessionLoadFromKeychain: vi.fn(),
  backendSubscriptionInstances: [] as unknown[],
  callbacks: {} as Record<string, (...args: any[]) => unknown>,
  cloudGraphql: vi.fn(),
  registerCustomerServiceCloudEvents: vi.fn(),
  handleAffiliateWorkItemChanged: vi.fn(),
  uploadCurrentLog: vi.fn(),
  rootStore: {
    upsertShopsFromGraphQL: vi.fn(),
    ingestGraphQLResponse: vi.fn(),
    findShopByObjectOrPlatformId: vi.fn(),
    getCustomerServiceShopIdsForDevice: vi.fn(() => []),
  },
}));

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../auth/session.js", () => ({
  AuthSessionManager: vi.fn().mockImplementation(function AuthSessionManager() {
    return {
    loadFromKeychain: mocks.authSessionLoadFromKeychain,
    graphqlFetch: vi.fn(),
    getAccessToken: vi.fn(() => null),
    };
  }),
}));

vi.mock("../auth/session-ref.js", () => ({
  setAuthSession: mocks.setAuthSession,
}));

vi.mock("../cloud/cloud-client.js", () => ({
  CloudClient: vi.fn().mockImplementation(function CloudClient() {
    return {
      graphql: mocks.cloudGraphql,
    };
  }),
}));

vi.mock("../cloud/backend-subscription-client.js", () => ({
  BackendSubscriptionClient: vi.fn().mockImplementation(function BackendSubscriptionClient() {
    const instance = {
      subscribeToOAuthComplete: vi.fn((callback) => {
        mocks.callbacks.oauthComplete = callback;
      }),
      subscribeToShopUpdated: vi.fn((callback) => {
        mocks.callbacks.shopUpdated = callback;
      }),
      subscribeToAdsOAuthComplete: vi.fn((callback) => {
        mocks.callbacks.adsOAuthComplete = callback;
      }),
      subscribeToAffiliateOutreachAccountConnected: vi.fn((callback) => {
        mocks.callbacks.affiliateOutreachAccountConnected = callback;
      }),
      subscribeToClientLogUploadRequests: vi.fn((_: string, callback) => {
        mocks.callbacks.clientLogUploadRequest = callback;
      }),
      subscribeToDevicePresenceProbeRequests: vi.fn((callback) => {
        mocks.callbacks.devicePresenceProbeRequest = callback;
      }),
      subscribeToAffiliateWorkItemChanges: vi.fn((callback) => {
        mocks.callbacks.affiliateWorkItemChanged = callback;
      }),
      subscribeToAffiliateActionProposalChanges: vi.fn((callback) => {
        mocks.callbacks.affiliateActionProposalChanged = callback;
      }),
    };
    mocks.backendSubscriptionInstances.push(instance);
    return instance;
  }),
}));

vi.mock("./store/desktop-store.js", () => ({
  rootStore: mocks.rootStore,
}));

vi.mock("../cs-bridge/customer-service-cloud-events.js", () => ({
  registerCustomerServiceCloudEvents: mocks.registerCustomerServiceCloudEvents,
}));

vi.mock("../affiliate/affiliate-work-item-actuator.js", () => ({
  handleAffiliateWorkItemChanged: mocks.handleAffiliateWorkItemChanged,
}));

vi.mock("../logs/upload-current-log.js", () => ({
  uploadCurrentLog: mocks.uploadCurrentLog,
}));

vi.mock("../cloud/init-queries.js", () => ({
  INIT_ADS_ADVERTISERS_QUERY: "query InitAdsAdvertisers { adsAdvertisers { id } }",
}));

describe("setupAuth backend subscription forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authSessionLoadFromKeychain.mockResolvedValue(undefined);
    mocks.cloudGraphql.mockResolvedValue({});
    mocks.uploadCurrentLog.mockResolvedValue({});
    mocks.backendSubscriptionInstances.length = 0;
    for (const key of Object.keys(mocks.callbacks)) {
      delete mocks.callbacks[key];
    }
  });

  it("forwards affiliate outreach account connection events to the Panel SSE bus", async () => {
    const { setupAuth } = await import("./auth-runtime.js");
    const broadcastEvent = vi.fn();
    const payload = {
      channel: "EMAIL",
      accountId: "email-1",
      displayName: "Seller Outlook",
      address: "seller@example.com",
    };

    await setupAuth({
      secretStore: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        listKeys: vi.fn().mockResolvedValue([]),
      },
      locale: "en-US",
      deviceId: "device-1",
      appVersion: "1.0.0-test",
      proxyFetch: vi.fn(),
      broadcastEvent,
    });

    expect(mocks.authSessionLoadFromKeychain).toHaveBeenCalledTimes(1);
    expect(mocks.callbacks.affiliateOutreachAccountConnected).toBeTypeOf("function");

    mocks.callbacks.affiliateOutreachAccountConnected(payload);

    expect(broadcastEvent).toHaveBeenCalledWith("affiliate-outreach-account-connected", payload);
  });
});
