import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSyncCloudProviderKey,
  mockSetAuthSession,
  mockPushChatSSE,
  mockRootStore,
  authState,
  backendState,
} = vi.hoisted(() => ({
  mockSyncCloudProviderKey: vi.fn(),
  mockSetAuthSession: vi.fn(),
  mockPushChatSSE: vi.fn(),
  mockRootStore: {
    ingestGraphQLResponse: vi.fn(),
    shops: [],
  },
  authState: {
    token: "token-1" as string | null,
    listeners: [] as Array<(user: any) => void | Promise<void>>,
  },
  backendState: {
    connected: false,
    reconnect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock("../src/providers/cloud-provider-sync.js", () => ({
  syncCloudProviderKey: mockSyncCloudProviderKey,
}));

vi.mock("../src/auth/session-ref.js", () => ({
  setAuthSession: mockSetAuthSession,
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
    reconnect() {
      backendState.reconnect();
    }
    disconnect() {
      backendState.disconnect();
    }
    subscribeToOAuthComplete() {
      return () => {};
    }
    subscribeToShopUpdated() {
      return () => {};
    }
  },
}));

import { setupAuth } from "../src/app/auth-runtime.js";

async function emitUserChanged(user: any) {
  for (const listener of authState.listeners) {
    await listener(user);
  }
}

describe("setupAuth subscription lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.token = "token-1";
    authState.listeners.length = 0;
    backendState.connected = false;
  });

  it("does not reconnect when validate hydrates the initial user with the same token", async () => {
    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      proxyFetch: vi.fn() as any,
      pushChatSSE: mockPushChatSSE as any,
    });

    backendState.connected = true;
    await emitUserChanged({ userId: "u1" });

    expect(backendState.reconnect).not.toHaveBeenCalled();
    expect(backendState.disconnect).not.toHaveBeenCalled();
  });

  it("reconnects when the authenticated token changes", async () => {
    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      proxyFetch: vi.fn() as any,
      pushChatSSE: mockPushChatSSE as any,
    });

    backendState.connected = true;
    authState.token = "token-2";
    await emitUserChanged({ userId: "u1" });

    expect(backendState.reconnect).toHaveBeenCalledTimes(1);
    expect(backendState.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects when the user logs out", async () => {
    await setupAuth({
      storage: {} as any,
      secretStore: {} as any,
      locale: "en",
      proxyFetch: vi.fn() as any,
      pushChatSSE: mockPushChatSSE as any,
    });

    backendState.connected = true;
    authState.token = null;
    await emitUserChanged(null);

    expect(backendState.disconnect).toHaveBeenCalledTimes(1);
    expect(backendState.reconnect).not.toHaveBeenCalled();
  });
});
