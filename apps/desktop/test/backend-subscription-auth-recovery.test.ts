import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("graphql-ws/client", () => ({
  createClient: createClientMock,
}));

import { BackendSubscriptionClient } from "../src/cloud/backend-subscription-client.js";

describe("BackendSubscriptionClient auth recovery", () => {
  const disposes: Array<ReturnType<typeof vi.fn>> = [];
  const subscriptions: Array<{ query: string; sink: { error: (err: unknown) => void } }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    disposes.length = 0;
    subscriptions.length = 0;

    createClientMock.mockImplementation(() => {
      const dispose = vi.fn();
      disposes.push(dispose);
      return {
        dispose,
        subscribe: (request: { query: string }, sink: { error: (err: unknown) => void }) => {
          subscriptions.push({ query: request.query, sink });
          return vi.fn();
        },
      };
    });
  });

  it("refreshes auth and re-subscribes after operation-level Authentication required errors", async () => {
    let token = "expired-token";
    const refreshAuth = vi.fn(async () => {
      token = "fresh-token";
    });

    const client = new BackendSubscriptionClient("en");
    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationSignals(vi.fn());

    expect(subscriptions).toHaveLength(1);

    subscriptions[0].sink.error([{ message: "Authentication required" }]);

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
      expect(createClientMock).toHaveBeenCalledTimes(3);
      expect(subscriptions).toHaveLength(2);
    });

    const latestConnectionParams = createClientMock.mock.calls.at(-1)?.[0].connectionParams;
    expect(latestConnectionParams()).toEqual({ authorization: "Bearer fresh-token" });

    client.disconnect();
  });

  it("coalesces simultaneous auth errors into one refresh", async () => {
    let token = "expired-token";
    let resolveRefresh!: () => void;
    const refreshAuth = vi.fn(() => new Promise<void>((resolve) => {
      resolveRefresh = () => {
        token = "fresh-token";
        resolve();
      };
    }));

    const client = new BackendSubscriptionClient("en");
    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsEscalationEvents(vi.fn());
    client.subscribeToCsConversationSignals(vi.fn());
    client.subscribeToAffiliateConversationSignals(vi.fn());

    subscriptions[0].sink.error([{ message: "Authentication required" }]);
    subscriptions[1].sink.error([{ message: "Authentication required" }]);
    subscriptions[2].sink.error([{ message: "Authentication required" }]);

    expect(refreshAuth).toHaveBeenCalledTimes(1);
    resolveRefresh();

    await vi.waitFor(() => {
      expect(createClientMock).toHaveBeenCalledTimes(3);
    });

    client.disconnect();
  });
});
