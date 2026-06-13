import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUploadCurrentLog,
  mockSyncCloudProviderKey,
  mockSetAuthSession,
  mockBroadcastEvent,
  mockRootStore,
  authState,
  backendState,
} = vi.hoisted(() => ({
  mockUploadCurrentLog: vi.fn(),
  mockSyncCloudProviderKey: vi.fn(),
  mockSetAuthSession: vi.fn(),
  mockBroadcastEvent: vi.fn(),
  mockRootStore: {
    ingestGraphQLResponse: vi.fn(),
    upsertShopsFromGraphQL: vi.fn(),
    shops: [],
  },
  authState: {
    token: "token-1" as string | null,
    listeners: [] as Array<(user: any) => void | Promise<void>>,
  },
  backendState: {
    connected: false,
    connect: vi.fn(),
    enableAuthenticatedSubscriptions: vi.fn(),
    disableAuthenticatedSubscriptions: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
    refreshCsConversationSignals: vi.fn(),
    oauthCompleteHandler: null as null | ((payload: any) => void),
    clientLogUploadHandler: null as null | ((request: any) => void),
  },
}));

vi.mock("../src/providers/cloud-provider-sync.js", () => ({
  syncCloudProviderKey: mockSyncCloudProviderKey,
}));

vi.mock("../src/auth/session-ref.js", () => ({
  setAuthSession: mockSetAuthSession,
}));

vi.mock("../src/logs/upload-current-log.js", () => ({
  uploadCurrentLog: mockUploadCurrentLog,
}));

vi.mock("../src/app/store/desktop-store.js", () => ({
  rootStore: mockRootStore,
}));

vi.mock("../src/auth/session.js", () => ({
  AuthSessionManager: class MockAuthSessionManager {
    onUserChanged(listener: (user: any) => void | Promise<void>) {
      authState.listeners.push(listener);
    }
    async loadFromKeychain() {}
    getAccessToken() {
      return authState.token;
    }
  },
}));

vi.mock("../src/cloud/backend-subscription-client.js", () => ({
  BackendSubscriptionClient: class MockBackendSubscriptionClient {
    isConnected() {
      return backendState.connected;
    }
    connect() {
      backendState.connect();
      backendState.connected = true;
    }
    enableAuthenticatedSubscriptions() {
      backendState.enableAuthenticatedSubscriptions();
    }
    disableAuthenticatedSubscriptions() {
      backendState.disableAuthenticatedSubscriptions();
    }
    reconnect() {
      backendState.reconnect();
    }
    disconnect() {
      backendState.disconnect();
    }
    subscribeToOAuthComplete(handler: (payload: any) => void) {
      backendState.oauthCompleteHandler = handler;
      return () => {};
    }
    subscribeToShopUpdated() {
      return () => {};
    }
    subscribeToClientLogUploadRequests(_deviceId: string, handler: (request: any) => void) {
      backendState.clientLogUploadHandler = handler;
      return () => {};
    }
    subscribeToDevicePresenceProbeRequests() {
      return () => {};
    }
    subscribeToCsEscalationEvents() {
      return () => {};
    }
    subscribeToCsConversationSignals() {
      return () => {};
    }
    subscribeToCsConversationChanges() {
      return () => {};
    }
    subscribeToAffiliateConversationSignals() {
      return () => {};
    }
    subscribeToAffiliateWorkItemChanges() {
      return () => {};
    }
    subscribeToAffiliateActionProposalChanges() {
      return () => {};
    }
    refreshCsConversationSignals() {
      backendState.refreshCsConversationSignals();
    }
  },
}));

import { setupAuth } from "../src/app/auth-runtime.js";

describe("setupAuth backend subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadCurrentLog.mockResolvedValue({ ok: true });
    authState.token = "token-1";
    authState.listeners.length = 0;
    backendState.connected = false;
    backendState.oauthCompleteHandler = null;
    backendState.clientLogUploadHandler = null;
  });

  it("bulk-upserts OAuth-complete shops without replacing the whole shop cache", async () => {
    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      deviceId: "device-1",
      proxyFetch: vi.fn() as any,
      broadcastEvent: mockBroadcastEvent as any,
    });

    backendState.oauthCompleteHandler?.({
      shopId: "shop-2",
      shopName: "Shop 2",
      platform: "TIKTOK_SHOP",
      shops: [
        {
          __typename: "Shop",
          id: "shop-2",
          platform: "TIKTOK_SHOP",
          platformShopId: "platform-shop-2",
          shopName: "Shop 2",
        },
        {
          __typename: "Shop",
          id: "shop-3",
          platform: "TIKTOK_SHOP",
          platformShopId: "platform-shop-3",
          shopName: "Shop 3",
        },
      ],
    });

    expect(mockRootStore.upsertShopsFromGraphQL).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "shop-2" }),
        expect.objectContaining({ id: "shop-3" }),
      ],
      "oauth-complete",
    );
    expect(mockRootStore.ingestGraphQLResponse).not.toHaveBeenCalledWith({
      shops: expect.any(Array),
    });
    expect(mockBroadcastEvent).toHaveBeenCalledWith(
      "oauth-complete",
      expect.objectContaining({ shopId: "shop-2" }),
    );
  });

  it("registers client log upload requests for this desktop device", async () => {
    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      deviceId: "device-1",
      proxyFetch: vi.fn() as any,
      broadcastEvent: mockBroadcastEvent as any,
    });

    expect(backendState.clientLogUploadHandler).toEqual(expect.any(Function));
  });

  it("uploads the current log once per in-flight server request", async () => {
    let resolveUpload: (value: unknown) => void = () => {};
    mockUploadCurrentLog.mockReturnValue(new Promise((resolve) => {
      resolveUpload = resolve;
    }));

    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      deviceId: "device-1",
      proxyFetch: vi.fn() as any,
      broadcastEvent: mockBroadcastEvent as any,
    });

    const request = {
      requestId: "req-1",
      requestedAt: "2026-05-31T12:00:00.000Z",
      reason: "support",
    };

    backendState.clientLogUploadHandler?.(request);
    backendState.clientLogUploadHandler?.(request);

    expect(mockUploadCurrentLog).toHaveBeenCalledTimes(1);
    expect(mockUploadCurrentLog).toHaveBeenCalledWith(expect.anything(), {
      deviceId: "device-1",
      requestId: "req-1",
    });

    resolveUpload({ ok: true });
    await Promise.resolve();
  });
});
