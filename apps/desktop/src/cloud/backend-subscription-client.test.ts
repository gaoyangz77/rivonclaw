import { beforeEach, describe, expect, it, vi } from "vitest";

type SubscriptionSink = {
  next: (result: { data?: Record<string, unknown>; errors?: Array<{ message?: string }> }) => void;
  error: (err: unknown) => void;
  complete: () => void;
};

type SubscribeCall = {
  operation: { query: string; variables?: Record<string, unknown> };
  sink: SubscriptionSink;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  clients: [] as Array<{
    subscribe: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    options: {
      connectionParams?: () => Record<string, string>;
      on?: {
        opened?: (socket: unknown) => void;
      };
    };
  }>,
  subscriptions: [] as SubscribeCall[],
  createClient: vi.fn(),
  createProxiedWebSocketClass: vi.fn(() => class MockWebSocket {}),
}));

vi.mock("graphql-ws/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@rivonclaw/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rivonclaw/core")>()),
  getApiBaseUrl: () => "https://api.example.test",
}));

vi.mock("../infra/proxy/proxy-aware-network.js", () => ({
  proxyNetwork: {
    createProxiedWebSocketClass: mocks.createProxiedWebSocketClass,
  },
}));

function installMockGraphqlWsClient(): void {
  mocks.createClient.mockImplementation((options) => {
    const client = {
      options,
      subscribe: vi.fn((operation, sink) => {
        const unsubscribe = vi.fn();
        mocks.subscriptions.push({ operation, sink, unsubscribe });
        return unsubscribe;
      }),
      dispose: vi.fn(),
      terminate: vi.fn(),
    };
    mocks.clients.push(client);
    return client;
  });
}

describe("BackendSubscriptionClient ToolSpecs lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clients.length = 0;
    mocks.subscriptions.length = 0;
    installMockGraphqlWsClient();
  });

  it("defers ToolSpecs subscription until authenticated subscriptions are enabled", async () => {
    const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
    let token: string | null = null;
    const onChanged = vi.fn();
    const client = new BackendSubscriptionClient("en-US");

    client.subscribeToToolSpecsChanged(onChanged);
    client.connect(() => token);

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptions).toHaveLength(0);
    expect(mocks.clients[0].options.connectionParams?.()).toEqual({});

    token = "access-token-1";
    client.enableAuthenticatedSubscriptions();

    expect(mocks.subscriptions).toHaveLength(1);
    expect(mocks.clients[0].options.connectionParams?.()).toEqual({
      authorization: "Bearer access-token-1",
    });
    expect(mocks.subscriptions[0].operation.query).toContain("subscription ToolSpecsChanged");
    expect(mocks.subscriptions[0].operation.query).toContain("toolSpecsChanged");

    mocks.subscriptions[0].sink.next({
      data: {
        toolSpecsChanged: {
          revision: "rev-1",
          digest: "digest-1",
          changedToolNames: ["ecom_list_shops"],
          changeType: "hard",
          reason: "test",
          publishedAt: "2026-06-29T00:00:00.000Z",
        },
      },
    });

    expect(onChanged).toHaveBeenCalledWith({
      revision: "rev-1",
      digest: "digest-1",
      changedToolNames: ["ecom_list_shops"],
      changeType: "hard",
      reason: "test",
      publishedAt: "2026-06-29T00:00:00.000Z",
    });
  });

  it("stops ToolSpecs subscription on logout and does not resubscribe without a token", async () => {
    const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
    let token: string | null = "access-token-1";
    const client = new BackendSubscriptionClient("en-US");

    client.connect(() => token);
    client.subscribeToToolSpecsChanged(vi.fn());
    client.enableAuthenticatedSubscriptions();

    expect(mocks.subscriptions).toHaveLength(1);

    token = null;
    client.disableAuthenticatedSubscriptions();

    expect(mocks.subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    client.enableAuthenticatedSubscriptions();
    expect(mocks.subscriptions).toHaveLength(1);
  });

  it("restarts the websocket transport when the authenticated token changes", async () => {
    const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
    let token: string | null = "access-token-1";
    const client = new BackendSubscriptionClient("en-US");

    client.connect(() => token);
    client.subscribeToToolSpecsChanged(vi.fn());
    client.enableAuthenticatedSubscriptions();

    const socket = { readyState: 1, close: vi.fn() };
    mocks.clients[0].options.on?.opened?.(socket);

    token = "access-token-2";
    client.enableAuthenticatedSubscriptions();

    expect(socket.close).toHaveBeenCalledWith(4205, "Client Restart");
    expect(mocks.clients[0].options.connectionParams?.()).toEqual({
      authorization: "Bearer access-token-2",
    });
    expect(mocks.subscriptions).toHaveLength(1);
  });
});

describe("BackendSubscriptionClient preset skill lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clients.length = 0;
    mocks.subscriptions.length = 0;
    installMockGraphqlWsClient();
  });

  it("defers preset skill subscription until authenticated subscriptions are enabled", async () => {
    const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
    let token: string | null = null;
    const onChanged = vi.fn();
    const client = new BackendSubscriptionClient("en-US");

    client.subscribeToPresetSkillsChanged(onChanged);
    client.connect(() => token);

    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptions).toHaveLength(0);

    token = "access-token-1";
    client.enableAuthenticatedSubscriptions();

    expect(mocks.subscriptions).toHaveLength(1);
    expect(mocks.subscriptions[0].operation.query).toContain("subscription PresetSkillsChanged");
    expect(mocks.subscriptions[0].operation.query).toContain("presetSkillsChanged");

    mocks.subscriptions[0].sink.next({
      data: {
        presetSkillsChanged: {
          revision: "2026-06-30T00:00:00.000Z",
          reason: "test",
          publishedAt: "2026-06-30T00:00:00.000Z",
        },
      },
    });

    expect(onChanged).toHaveBeenCalledWith({
      revision: "2026-06-30T00:00:00.000Z",
      reason: "test",
      publishedAt: "2026-06-30T00:00:00.000Z",
    });
  });

  it("stops preset skill subscription on logout", async () => {
    const { BackendSubscriptionClient } = await import("./backend-subscription-client.js");
    let token: string | null = "access-token-1";
    const client = new BackendSubscriptionClient("en-US");

    client.connect(() => token);
    client.subscribeToPresetSkillsChanged(vi.fn());
    client.enableAuthenticatedSubscriptions();

    expect(mocks.subscriptions).toHaveLength(1);

    token = null;
    client.disableAuthenticatedSubscriptions();

    expect(mocks.subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    client.enableAuthenticatedSubscriptions();
    expect(mocks.subscriptions).toHaveLength(1);
  });
});
