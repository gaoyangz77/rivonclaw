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
  const clientOptions: Array<{
    on?: {
      closed?: (event: unknown) => void;
      connected?: (socket: unknown, payload: unknown, retrying: boolean) => void;
      error?: (err: unknown) => void;
      opened?: (socket: unknown) => void;
      ping?: (received: boolean) => void;
      pong?: (received: boolean) => void;
    };
    connectionParams?: () => unknown;
  }> = [];
  const sockets: Array<{ readyState: number; close: ReturnType<typeof vi.fn> }> = [];
  const subscriptions: Array<{
    query: string;
    unsubscribe: ReturnType<typeof vi.fn>;
    sink: {
      next?: (result: unknown) => void;
      error: (err: unknown) => void;
      complete: () => void;
    };
  }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    disposes.length = 0;
    clientOptions.length = 0;
    sockets.length = 0;
    subscriptions.length = 0;

    createClientMock.mockImplementation((options) => {
      clientOptions.push(options);
      const dispose = vi.fn();
      disposes.push(dispose);
      const socket = { readyState: 1, close: vi.fn() };
      sockets.push(socket);
      return {
        dispose,
        terminate: vi.fn(),
        subscribe: (request: { query: string }, sink: {
          next?: (result: unknown) => void;
          error: (err: unknown) => void;
          complete: () => void;
        }) => {
          const unsubscribe = vi.fn();
          subscriptions.push({ query: request.query, sink, unsubscribe });
          return unsubscribe;
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
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));

    expect(subscriptions).toHaveLength(1);

    subscriptions[0].sink.error([{ message: "Authentication required" }]);

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
      expect(subscriptions).toHaveLength(2);
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(sockets.at(-1)?.close).toHaveBeenCalledWith(4205, "Client Restart");
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({ authorization: "Bearer fresh-token" });

    client.disconnect();
  });

  it("refreshes auth and re-subscribes after authenticated connection close", async () => {
    let token = "expired-token";
    const refreshAuth = vi.fn(async () => {
      token = "fresh-token";
    });

    const client = new BackendSubscriptionClient("en");
    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());
    client.subscribeToAffiliateWorkItemChanges(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));

    expect(subscriptions).toHaveLength(2);

    clientOptions.at(-1)?.on?.closed?.({ code: 4401, reason: "Unauthorized" });

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(2);
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({ authorization: "Bearer fresh-token" });

    client.disconnect();
  });

  it("can force reconnect authenticated subscriptions after auth lifecycle settles", async () => {
    const client = new BackendSubscriptionClient("en");
    client.connect(() => "stable-token");
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));

    expect(subscriptions).toHaveLength(1);

    client.enableAuthenticatedSubscriptions({ forceReconnect: true });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(1);
    expect(sockets.at(-1)?.close).toHaveBeenCalledWith(4205, "Client Restart");
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({ authorization: "Bearer stable-token" });

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
    client.subscribeToAffiliateWorkItemChanges(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));

    subscriptions[0].sink.error([{ message: "Authentication required" }]);
    subscriptions[1].sink.error([{ message: "Authentication required" }]);
    subscriptions[2].sink.error([{ message: "Authentication required" }]);

    expect(refreshAuth).toHaveBeenCalledTimes(1);
    resolveRefresh();

    await vi.waitFor(() => {
      expect(createClientMock).toHaveBeenCalledTimes(1);
      expect(subscriptions).toHaveLength(6);
    });

    client.disconnect();
  });

  it("re-subscribes long-lived authenticated subscriptions after operation complete", async () => {
    vi.useFakeTimers();
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "token");
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn());

      expect(subscriptions).toHaveLength(1);
      subscriptions[0].sink.complete();

      await vi.advanceTimersByTimeAsync(1_000);

      expect(subscriptions).toHaveLength(2);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("recovers a CS operation after Not found without refreshing or invalidating auth", async () => {
    vi.useFakeTimers();
    const refreshAuth = vi.fn(async () => {});
    const onConversation = vi.fn();
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token", { refreshAuth });
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(onConversation);

      expect(subscriptions).toHaveLength(1);
      subscriptions[0].sink.error([{ message: "Not found" }]);

      expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
      expect(refreshAuth).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(999);
      expect(subscriptions).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(subscriptions).toHaveLength(2);

      subscriptions[1].sink.next?.({
        data: { csConversationChanged: { conversationId: "conversation-1" } },
      });
      expect(onConversation).toHaveBeenCalledWith({ conversationId: "conversation-1" });
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("blocks contract errors and retries them only once on a new transport generation", async () => {
    vi.useFakeTimers();
    const refreshAuth = vi.fn(async () => {});
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token", { refreshAuth });
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn());

      const validationError = [{
        message: 'Cannot query field "removedField" on type "CustomerServiceConversation".',
        extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
      }];
      subscriptions[0].sink.error(validationError);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(subscriptions).toHaveLength(1);
      expect(refreshAuth).not.toHaveBeenCalled();

      clientOptions.at(-1)?.on?.connected?.({}, undefined, true);
      await vi.runAllTicks();
      expect(subscriptions).toHaveLength(2);

      subscriptions[1].sink.error(validationError);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(subscriptions).toHaveLength(2);
      expect(refreshAuth).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("cancels a pending operation retry when an explicit refresh starts a newer attempt", async () => {
    vi.useFakeTimers();
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token");
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn());

      subscriptions[0].sink.error([{ message: "Not found" }]);
      client.refreshCsConversationChanges();
      expect(subscriptions).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(subscriptions).toHaveLength(2);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("blocks an unknown operation error after five bounded retries", async () => {
    vi.useFakeTimers();
    const refreshAuth = vi.fn(async () => {});
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token", { refreshAuth });
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn());

      const unknownError = [{ message: "Unexpected subscription failure" }];
      const retryDelays = [1_000, 2_000, 4_000, 8_000, 16_000];
      for (const delayMs of retryDelays) {
        subscriptions.at(-1)?.sink.error(unknownError);
        await vi.advanceTimersByTimeAsync(delayMs);
      }

      expect(subscriptions).toHaveLength(6);
      subscriptions.at(-1)?.sink.error(unknownError);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(subscriptions).toHaveLength(6);
      expect(refreshAuth).not.toHaveBeenCalled();
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("does not let an operation recovery timer restart after logout", async () => {
    vi.useFakeTimers();
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token");
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn());

      subscriptions[0].sink.error([{ message: "Not found" }]);
      client.disableAuthenticatedSubscriptions();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(subscriptions).toHaveLength(1);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("treats Forbidden as a blocked operation error rather than an auth failure", async () => {
    vi.useFakeTimers();
    const refreshAuth = vi.fn(async () => {});
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "stable-token", { refreshAuth });
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationSignals(vi.fn());

      subscriptions[0].sink.error([{ message: "Forbidden" }]);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(refreshAuth).not.toHaveBeenCalled();
      expect(subscriptions).toHaveLength(1);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("lets graphql-ws replay active subscriptions after transport reconnect", async () => {
    const onConnectedAfterRetry = vi.fn(async () => {});
    const client = new BackendSubscriptionClient("en");

    client.connect(() => "token", { onConnectedAfterRetry });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());
    client.subscribeToUpdates("1.0.0", vi.fn());

    expect(subscriptions).toHaveLength(2);

    clientOptions.at(-1)?.on?.connected?.({}, undefined, true);

    await vi.waitFor(() => {
      expect(onConnectedAfterRetry).toHaveBeenCalledTimes(1);
    });
    expect(subscriptions).toHaveLength(2);

    client.disconnect();
  });

  it("does not manually restart subscriptions if the transport reconnect hook fails", async () => {
    const onConnectedAfterRetry = vi.fn(async () => {
      throw new Error("shop refresh failed");
    });
    const client = new BackendSubscriptionClient("en");

    client.connect(() => "token", { onConnectedAfterRetry });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());

    expect(subscriptions).toHaveLength(1);

    clientOptions.at(-1)?.on?.connected?.({}, undefined, true);

    await vi.waitFor(() => {
      expect(onConnectedAfterRetry).toHaveBeenCalledTimes(1);
    });
    expect(subscriptions).toHaveLength(1);

    client.disconnect();
  });

  it("starts OAuth completion subscriptions only after auth is ready", async () => {
    vi.useFakeTimers();
    const client = new BackendSubscriptionClient("en");

    try {
      let token: string | null = null;
      client.connect(() => token);
      client.subscribeToOAuthComplete(vi.fn());

      expect(subscriptions).toHaveLength(0);

      token = "token";
      client.enableAuthenticatedSubscriptions();
      expect(subscriptions).toHaveLength(1);

      subscriptions[0].sink.complete();

      await vi.advanceTimersByTimeAsync(1_000);

      expect(subscriptions).toHaveLength(2);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });

  it("suspends authenticated subscriptions after JWT signature failure without clearing auth", async () => {
    let token: string | null = "staging-token";
    const refreshAuth = vi.fn(async () => {
      throw new Error("invalid signature");
    });

    const client = new BackendSubscriptionClient("en");
    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToOAuthComplete(vi.fn());
    client.subscribeToAdsOAuthComplete(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));

    expect(subscriptions).toHaveLength(2);

    subscriptions[0].sink.error(new Error("invalid signature"));

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
    });

    client.subscribeToClientLogUploadRequests("device-1", vi.fn());

    expect(token).toBe("staging-token");
    expect(subscriptions).toHaveLength(2);

    token = "rotated-token";
    await client.handleCredentialsChanged();

    expect(subscriptions).toHaveLength(5);
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({
      authorization: "Bearer rotated-token",
    });
    client.disconnect();
  });

  it("suspends after a transient auth refresh failure and resumes on credential rotation", async () => {
    let token: string | null = "stale-token";
    const refreshAuth = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const client = new BackendSubscriptionClient("en");

    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());

    subscriptions[0].sink.error([{ message: "Authentication required" }]);

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
      expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    });

    client.subscribeToClientLogUploadRequests("device-1", vi.fn());
    expect(subscriptions).toHaveLength(1);

    token = "rotated-token";
    await client.handleCredentialsChanged();

    expect(subscriptions).toHaveLength(3);
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({
      authorization: "Bearer rotated-token",
    });
    client.disconnect();
  });

  it("does not restart twice when auth recovery also emits a credentials change", async () => {
    let token = "expired-token";
    let client!: BackendSubscriptionClient;
    const refreshAuth = vi.fn(async () => {
      token = "fresh-token";
      await client.handleCredentialsChanged();
    });

    client = new BackendSubscriptionClient("en");
    client.connect(() => token, { refreshAuth });
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationSignals(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));
    sockets.at(-1)?.close.mockClear();

    subscriptions[0].sink.error([{ message: "Authentication required" }]);

    await vi.waitFor(() => {
      expect(refreshAuth).toHaveBeenCalledTimes(1);
      expect(subscriptions).toHaveLength(2);
    });

    expect(sockets.at(-1)?.close).toHaveBeenCalledTimes(1);
    expect(clientOptions.at(-1)?.connectionParams?.()).toEqual({
      authorization: "Bearer fresh-token",
    });
    client.disconnect();
  });

  it("does not enable authenticated subscriptions from a credentials event before auth bootstrap", async () => {
    let token: string | null = null;
    const client = new BackendSubscriptionClient("en");
    client.connect(() => token);
    client.subscribeToCsConversationChanges(vi.fn());

    token = "bootstrap-token";
    await client.handleCredentialsChanged();

    expect(subscriptions).toHaveLength(0);

    client.enableAuthenticatedSubscriptions();
    expect(subscriptions).toHaveLength(1);
    client.disconnect();
  });

  it("ignores unchanged active credentials", async () => {
    const client = new BackendSubscriptionClient("en");
    client.connect(() => "stable-token");
    client.enableAuthenticatedSubscriptions();
    client.subscribeToCsConversationChanges(vi.fn());
    clientOptions.at(-1)?.on?.opened?.(sockets.at(-1));
    sockets.at(-1)?.close.mockClear();

    await client.handleCredentialsChanged();

    expect(subscriptions).toHaveLength(1);
    expect(sockets.at(-1)?.close).not.toHaveBeenCalled();
    client.disconnect();
  });

  it("does not recover a locally disposed operation during shop-id refresh", async () => {
    vi.useFakeTimers();
    const client = new BackendSubscriptionClient("en");

    try {
      client.connect(() => "token");
      client.enableAuthenticatedSubscriptions();
      client.subscribeToCsConversationChanges(vi.fn(), { getShopIds: () => ["shop-1"] });

      expect(subscriptions).toHaveLength(1);
      client.refreshCsConversationChanges();
      expect(subscriptions).toHaveLength(2);

      subscriptions[0].sink.complete();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(subscriptions).toHaveLength(2);
    } finally {
      client.disconnect();
      vi.useRealTimers();
    }
  });
});
