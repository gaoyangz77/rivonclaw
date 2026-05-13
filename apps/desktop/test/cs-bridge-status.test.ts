import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures values exist when vi.mock factories run
// ---------------------------------------------------------------------------

const { mockRuntimeStatusStore, mockGetAuthSession, mockShops } = vi.hoisted(() => ({
  mockRuntimeStatusStore: {
    setCsBridgeConnected: vi.fn(),
    setCsBridgeDisconnected: vi.fn(),
    setCsBridgeReconnecting: vi.fn(),
  },
  mockGetAuthSession: vi.fn(() => ({
    getAccessToken: () => "mock-token",
    refresh: vi.fn().mockResolvedValue("refreshed-token"),
  })),
  // Mutable shops array — syncFromCache reads rootStore.shops
  mockShops: [] as any[],
}));

vi.mock("../src/app/store/runtime-status-store.js", () => ({
  runtimeStatusStore: mockRuntimeStatusStore,
}));

vi.mock("../src/app/store/desktop-store.js", () => ({
  rootStore: { get shops() { return mockShops; } },
}));

vi.mock("../src/auth/session-ref.js", () => ({
  getAuthSession: mockGetAuthSession,
}));

vi.mock("../src/app/storage-ref.js", () => ({
  getStorageRef: () => null,
}));

vi.mock("../src/utils/platform.js", () => ({
  normalizePlatform: (p: string) => p,
}));

vi.mock("mobx", async () => {
  const actual = await vi.importActual<typeof import("mobx")>("mobx");
  return {
    ...actual,
    reaction: vi.fn(() => () => {}),
  };
});

import { CustomerServiceBridge } from "../src/cs-bridge/customer-service-bridge.js";

/** A mock shop object that syncFromCache() will recognize as CS-enabled. */
const MOCK_SHOP = {
  id: "shop1",
  platformShopId: "plat1",
  shopName: "Test Shop",
  platform: "tiktok",
  handlesCustomerServiceOnDevice: () => true,
  services: {
    customerService: {
      enabled: true,
      csDeviceId: "test-gateway",
      // `assembledPrompt` is now a view on the Shop MST model that composes
      // `platformSystemPrompt` (embedded per-shop by the backend) with
      // `businessPrompt`. The mock rootStore in this file is a bare stub
      // that bypasses the real MST, so we supply the final assembled string
      // directly — syncFromCache() only reads `cs.assembledPrompt`.
      assembledPrompt: "You are a helpful CS agent",
      businessPrompt: "You are a helpful CS agent",
      platformSystemPrompt: "PLATFORM CS PROMPT",
      csProviderOverride: null,
      csModelOverride: null,
      runProfileId: null,
    },
  },
};

describe("CustomerServiceBridge → runtimeStatusStore integration", () => {
  let bridge: CustomerServiceBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Populate the mock entity cache so syncFromCache() finds our shop
    mockShops.length = 0;
    mockShops.push(MOCK_SHOP);

    bridge = new CustomerServiceBridge({
      relayUrl: "wss://mock-relay",
      gatewayId: "test-gateway",
    });
  });

  afterEach(() => {
    bridge.stop();
    vi.useRealTimers();
  });

  it("should set connected on cs_ack", async () => {
    await bridge.start();
    await vi.advanceTimersByTimeAsync(10);

    expect(mockRuntimeStatusStore.setCsBridgeConnected).toHaveBeenCalled();
  });

  it("should set disconnected on stop after start", async () => {
    await bridge.start();
    await vi.advanceTimersByTimeAsync(10);

    bridge.stop();

    expect(mockRuntimeStatusStore.setCsBridgeDisconnected).toHaveBeenCalled();
  });

  it("should set disconnected on stop()", () => {
    bridge.stop();
    expect(mockRuntimeStatusStore.setCsBridgeDisconnected).toHaveBeenCalled();
  });
});
