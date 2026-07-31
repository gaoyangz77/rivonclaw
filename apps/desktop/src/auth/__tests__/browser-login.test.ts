import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetFirstPartyDomainRouteForTests,
  setFirstPartyDomainRoute,
} from "@rivonclaw/core";
import type { AuthSessionManager } from "../session.js";

const gatewayMocks = vi.hoisted(() => ({
  startLoopbackOAuthCallback: vi.fn(),
}));

vi.mock("@rivonclaw/gateway", () => ({
  startLoopbackOAuthCallback: gatewayMocks.startLoopbackOAuthCallback,
}));

import { DesktopBrowserLoginCoordinator } from "../browser-login.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("DesktopBrowserLoginCoordinator", () => {
  let callback: ReturnType<typeof deferred<{ code: string; state: string }>>;
  let close: ReturnType<typeof vi.fn>;
  let authSession: {
    graphqlFetch: ReturnType<typeof vi.fn>;
    storeTokens: ReturnType<typeof vi.fn>;
    setCachedUser: ReturnType<typeof vi.fn>;
  };
  let openExternal: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>;

  beforeEach(() => {
    resetFirstPartyDomainRouteForTests();
    callback = deferred();
    close = vi.fn((reason?: Error) => {
      if (reason) callback.reject(reason);
    });
    gatewayMocks.startLoopbackOAuthCallback.mockReset();
    gatewayMocks.startLoopbackOAuthCallback.mockResolvedValue({
      port: 53684,
      redirectUri: "http://127.0.0.1:53684/oauth/tkcopilot/callback",
      usedPreferredPort: true,
      waitForCallback: callback.promise,
      close,
    });
    authSession = {
      graphqlFetch: vi
        .fn()
        .mockResolvedValueOnce({
          startBrowserToDesktopLogin: {
            authorizationUrl: "https://www.tkcopilot.com/account/desktop-login?ticket=ticket",
          },
        })
        .mockResolvedValueOnce({
          exchangeBrowserToDesktopLoginCode: {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            user: { userId: "user-1", email: "owner@example.com" },
          },
        }),
      storeTokens: vi.fn().mockResolvedValue(undefined),
      setCachedUser: vi.fn(),
    };
    openExternal = vi.fn().mockResolvedValue(undefined);
  });

  it("opens the first-party approval page and exchanges the loopback code with PKCE", async () => {
    const onSuccess = vi.fn();
    const coordinator = new DesktopBrowserLoginCoordinator({
      authSession: authSession as unknown as AuthSessionManager,
      openExternal,
      onSuccess,
      deviceName: "Test Mac",
    });

    const started = await coordinator.start();
    expect(started.status).toBe("pending");
    const startVariables = authSession.graphqlFetch.mock.calls[0]![1];
    expect(startVariables.input).toMatchObject({
      redirectUri: "http://127.0.0.1:53684/oauth/tkcopilot/callback",
      deviceName: "Test Mac",
      surface: "GLOBAL",
    });
    expect(startVariables.input.state).toBeTruthy();
    expect(startVariables.input.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await vi.waitFor(() =>
      expect(openExternal).toHaveBeenCalledWith(
        "https://www.tkcopilot.com/account/desktop-login?ticket=ticket",
      ),
    );

    callback.resolve({ code: "one-time-code", state: startVariables.input.state });
    await vi.waitFor(() => expect(coordinator.status(started.flowId)?.status).toBe("completed"));

    expect(authSession.graphqlFetch.mock.calls[1]![1]).toMatchObject({
      input: {
        code: "one-time-code",
        codeVerifier: expect.any(String),
      },
    });
    expect(authSession.storeTokens).toHaveBeenCalledWith("access-token", "refresh-token");
    expect(authSession.setCachedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.com" }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("opens the China browser surface when Desktop uses the China API route", async () => {
    setFirstPartyDomainRoute("cn-relay");
    const coordinator = new DesktopBrowserLoginCoordinator({
      authSession: authSession as unknown as AuthSessionManager,
      openExternal,
    });

    await coordinator.start();

    expect(authSession.graphqlFetch.mock.calls[0]![1]).toMatchObject({
      input: { surface: "CN_RELAY" },
    });
  });

  it("cancels a pending flow without storing credentials", async () => {
    const coordinator = new DesktopBrowserLoginCoordinator({
      authSession: authSession as unknown as AuthSessionManager,
      openExternal,
    });
    const started = await coordinator.start();
    expect(coordinator.cancel(started.flowId)).toMatchObject({
      status: "cancelled",
      errorCode: "BROWSER_AUTH_CANCELLED",
    });
    expect(authSession.storeTokens).not.toHaveBeenCalled();
  });
});
