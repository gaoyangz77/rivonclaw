import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GraphqlRequestError, type AuthSessionManager } from "../session.js";

const gatewayMocks = vi.hoisted(() => ({
  startLoopbackOAuthCallback: vi.fn(),
}));
const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("@rivonclaw/gateway", () => ({
  startLoopbackOAuthCallback: gatewayMocks.startLoopbackOAuthCallback,
}));
vi.mock("@rivonclaw/logger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@rivonclaw/logger")>(),
  createLogger: () => ({ warn: loggerMocks.warn }),
}));

import { DesktopGoogleAuthCoordinator } from "../google-oauth.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("DesktopGoogleAuthCoordinator", () => {
  let callback: ReturnType<typeof deferred<{ code: string; state: string }>>;
  let authSession: {
    getDesktopGoogleAuthConfig: ReturnType<typeof vi.fn>;
    exchangeDesktopGoogleCode: ReturnType<typeof vi.fn>;
    loginWithGoogle: ReturnType<typeof vi.fn>;
  };
  let openExternal: Mock<(url: string) => Promise<unknown>>;
  let close: Mock<(reason?: Error) => void>;

  beforeEach(() => {
    callback = deferred();
    close = vi.fn<(reason?: Error) => void>((reason) => {
      if (reason) callback.reject(reason);
    });
    gatewayMocks.startLoopbackOAuthCallback.mockReset();
    loggerMocks.warn.mockReset();
    gatewayMocks.startLoopbackOAuthCallback.mockResolvedValue({
      port: 53682,
      redirectUri: "http://127.0.0.1:53682/oauth/google/callback",
      usedPreferredPort: true,
      waitForCallback: callback.promise,
      close,
    });
    authSession = {
      getDesktopGoogleAuthConfig: vi.fn().mockResolvedValue({
        enabled: true,
        clientId: "desktop-client.apps.googleusercontent.com",
      }),
      exchangeDesktopGoogleCode: vi.fn().mockResolvedValue("google-id-token"),
      loginWithGoogle: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    openExternal = vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue(undefined);
  });

  function coordinator(onSuccess = vi.fn()) {
    return {
      instance: new DesktopGoogleAuthCoordinator({
        authSession: authSession as unknown as AuthSessionManager,
        openExternal,
        onSuccess,
      }),
      onSuccess,
    };
  }

  it("opens the system browser with PKCE and exchanges the code through the backend", async () => {
    const { instance, onSuccess } = coordinator();
    const started = await instance.start({ inviteCode: "ABC123" });

    expect(started).toMatchObject({ status: "pending" });
    await vi.waitFor(() => expect(openExternal).toHaveBeenCalledTimes(1));
    const authorizationUrl = new URL(openExternal.mock.calls[0]![0]);
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
    expect(authorizationUrl.searchParams.get("nonce")).toBeTruthy();
    expect(authorizationUrl.searchParams.has("client_secret")).toBe(false);

    callback.resolve({
      code: "authorization-code",
      state: authorizationUrl.searchParams.get("state")!,
    });
    await vi.waitFor(() => expect(instance.status(started.flowId)?.status).toBe("completed"));

    expect(authSession.exchangeDesktopGoogleCode).toHaveBeenCalledWith({
      code: "authorization-code",
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/),
      redirectUri: "http://127.0.0.1:53682/oauth/google/callback",
    });
    expect(authSession.loginWithGoogle).toHaveBeenCalledWith(expect.objectContaining({
      idToken: "google-id-token",
      nonce: authorizationUrl.searchParams.get("nonce"),
      inviteCode: "ABC123",
    }));
    expect(instance.status(started.flowId)).not.toHaveProperty("idToken");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps the ID token in main-process memory for password linking", async () => {
    authSession.loginWithGoogle
      .mockRejectedValueOnce(
        new GraphqlRequestError("Link required", "GOOGLE_ACCOUNT_LINK_REQUIRED"),
      )
      .mockResolvedValueOnce({ userId: "existing-user" });
    const { instance } = coordinator();
    const started = await instance.start();
    const authorizationUrl = new URL(openExternal.mock.calls[0]![0]);
    callback.resolve({
      code: "authorization-code",
      state: authorizationUrl.searchParams.get("state")!,
    });
    await vi.waitFor(() => {
      expect(instance.status(started.flowId)?.status).toBe("link_required");
    });

    await expect(instance.link({
      flowId: started.flowId,
      password: "original-password",
      captchaToken: "captcha-token",
      captchaAnswer: "ABCD",
    })).resolves.toMatchObject({ status: "completed" });
    expect(authSession.loginWithGoogle).toHaveBeenLastCalledWith(expect.objectContaining({
      idToken: "google-id-token",
      link: {
        password: "original-password",
        captchaToken: "captcha-token",
        captchaAnswer: "ABCD",
      },
    }));
  });

  it("cancels an active flow and rejects later linking", async () => {
    const { instance } = coordinator();
    const started = await instance.start();

    expect(instance.cancel(started.flowId)).toMatchObject({ status: "cancelled" });
    expect(instance.status(started.flowId)).toMatchObject({
      status: "cancelled",
      errorCode: "GOOGLE_AUTH_CANCELLED",
    });
    await expect(instance.link({
      flowId: started.flowId,
      password: "password",
      captchaToken: "captcha",
      captchaAnswer: "ABCD",
    })).rejects.toMatchObject({ code: "GOOGLE_AUTH_FLOW_NOT_FOUND" });
  });

  it("fails closed when the backend disables Desktop Google sign-in", async () => {
    authSession.getDesktopGoogleAuthConfig.mockResolvedValue({ enabled: false });
    const { instance } = coordinator();

    await expect(instance.start()).rejects.toMatchObject({
      code: "GOOGLE_AUTH_UNAVAILABLE",
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("logs a sanitized backend exchange failure without OAuth secrets", async () => {
    authSession.exchangeDesktopGoogleCode.mockRejectedValue(
      new GraphqlRequestError("response included sensitive content", "GOOGLE_AUTH_FAILED"),
    );
    const { instance } = coordinator();
    const started = await instance.start();
    const authorizationUrl = new URL(openExternal.mock.calls[0]![0]);
    callback.resolve({
      code: "authorization-code",
      state: authorizationUrl.searchParams.get("state")!,
    });

    await vi.waitFor(() => expect(instance.status(started.flowId)?.status).toBe("failed"));
    expect(loggerMocks.warn).toHaveBeenCalledWith("Desktop Google sign-in failed", {
      category: "GOOGLE_AUTH_FAILED",
      stage: "exchanging_code",
      errorType: "GraphqlRequestError",
      graphqlCode: "GOOGLE_AUTH_FAILED",
    });
    expect(JSON.stringify(loggerMocks.warn.mock.calls)).not.toContain("authorization-code");
    expect(JSON.stringify(loggerMocks.warn.mock.calls)).not.toContain("sensitive content");
  });
});
